/**
 * Telegram Bot Provider
 *
 * Sends messages to Telegram and receives text responses via long polling.
 */

export interface TelegramConfig {
  botToken: string;
  responseTimeoutMs: number;
  chatId?: number;
}

interface TelegramMessage {
  message_id: number;
  from?: { id: number };
  chat: { id: number };
  date: number;
  text?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export class TelegramBot {
  private config: TelegramConfig;
  private baseUrl: string;
  private lastUpdateId = 0;
  private activeChatId: number | null = null;

  constructor(config: TelegramConfig) {
    this.config = config;
    this.baseUrl = `https://api.telegram.org/bot${config.botToken}`;
    if (config.chatId) {
      this.activeChatId = config.chatId;
    }
  }

  /**
   * Send a message to the active chat
   */
  async sendMessage(text: string): Promise<number> {
    if (!this.activeChatId) {
      throw new Error('No active chat. Waiting for user to message the bot first.');
    }

    const response = await fetch(`${this.baseUrl}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: this.activeChatId,
        text,
        parse_mode: 'Markdown',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send Telegram message: ${error}`);
    }

    const result = await response.json() as { ok: boolean; result: TelegramMessage };
    return result.result.message_id;
  }

  /**
   * Wait for a text response from the user
   * Uses long polling to get updates
   */
  async waitForResponse(): Promise<string> {
    const startTime = Date.now();
    const timeout = this.config.responseTimeoutMs;

    while (Date.now() - startTime < timeout) {
      const updates = await this.getUpdates();

      for (const update of updates) {
        if (update.message?.text) {
          // Remember the chat ID for sending responses
          this.activeChatId = update.message.chat.id;
          return update.message.text;
        }
      }

      // Small delay before next poll
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error('Response timeout - no message received');
  }

  /**
   * Get updates via long polling
   */
  private async getUpdates(): Promise<TelegramUpdate[]> {
    const params = new URLSearchParams({
      offset: (this.lastUpdateId + 1).toString(),
      timeout: '10',
      allowed_updates: JSON.stringify(['message']),
    });

    const response = await fetch(`${this.baseUrl}/getUpdates?${params}`);

    if (!response.ok) {
      throw new Error(`Failed to get Telegram updates: ${await response.text()}`);
    }

    const result = await response.json() as { ok: boolean; result: TelegramUpdate[] };
    const updates = result.result;

    // Update the offset to acknowledge processed updates
    if (updates.length > 0) {
      this.lastUpdateId = updates[updates.length - 1].update_id;
    }

    return updates;
  }

  /**
   * Clear any pending updates (call on startup to avoid processing old messages)
   */
  async clearPendingUpdates(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/getUpdates?offset=-1&limit=1`);
    if (response.ok) {
      const result = await response.json() as { ok: boolean; result: TelegramUpdate[] };
      if (result.result.length > 0) {
        this.lastUpdateId = result.result[0].update_id;
      }
    }
  }

  /**
   * Check if we have an active chat
   */
  hasActiveChat(): boolean {
    return this.activeChatId !== null;
  }
}
