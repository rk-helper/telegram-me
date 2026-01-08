/**
 * Message Manager
 *
 * Manages conversations with the user via Telegram.
 * Claude sends a message, user responds via text.
 */

import { TelegramBot, TelegramConfig } from './telegram.js';

interface ConversationState {
  conversationId: string;
  conversationHistory: Array<{ speaker: 'claude' | 'user'; message: string }>;
  startTime: number;
  active: boolean;
}

export interface MessageManagerConfig {
  telegramBotToken: string;
  responseTimeoutMs: number;
  telegramChatId?: number;
}

export function loadMessageManagerConfig(): MessageManagerConfig {
  if (!process.env.CALLME_TELEGRAM_BOT_TOKEN) {
    throw new Error('Missing CALLME_TELEGRAM_BOT_TOKEN');
  }

  const chatId = process.env.CALLME_TELEGRAM_CHAT_ID
    ? parseInt(process.env.CALLME_TELEGRAM_CHAT_ID, 10)
    : undefined;

  return {
    telegramBotToken: process.env.CALLME_TELEGRAM_BOT_TOKEN,
    responseTimeoutMs: parseInt(process.env.CALLME_RESPONSE_TIMEOUT_MS || '180000', 10),
    telegramChatId: chatId,
  };
}

export class MessageManager {
  private config: MessageManagerConfig;
  private telegram: TelegramBot;
  private activeConversations = new Map<string, ConversationState>();
  private currentConversationId = 0;

  constructor(config: MessageManagerConfig) {
    this.config = config;
    this.telegram = new TelegramBot({
      botToken: config.telegramBotToken,
      responseTimeoutMs: config.responseTimeoutMs,
      chatId: config.telegramChatId,
    });
  }

  /**
   * Initialize the message manager (clear pending Telegram updates)
   */
  async initialize(): Promise<void> {
    await this.telegram.clearPendingUpdates();
    console.error('[MessageManager] Initialized, pending updates cleared');
  }

  /**
   * Start a new conversation - send message and wait for response
   */
  async sendMessage(message: string): Promise<{ conversationId: string; response: string }> {
    const conversationId = `conv-${++this.currentConversationId}-${Date.now()}`;

    const state: ConversationState = {
      conversationId,
      conversationHistory: [],
      startTime: Date.now(),
      active: true,
    };

    this.activeConversations.set(conversationId, state);

    try {
      console.error(`[${conversationId}] Sending message: ${message.substring(0, 50)}...`);

      // If no active chat yet, wait for user to message first
      if (!this.telegram.hasActiveChat()) {
        console.error(`[${conversationId}] Waiting for user to message the bot first...`);
        const firstMessage = await this.telegram.waitForResponse();
        console.error(`[${conversationId}] User initiated chat: ${firstMessage.substring(0, 50)}...`);
      }

      // Send message to Telegram
      await this.telegram.sendMessage(`🤖 *Claude:*\n${message}`);

      // Wait for user response
      console.error(`[${conversationId}] Waiting for response...`);
      const response = await this.telegram.waitForResponse();

      state.conversationHistory.push({ speaker: 'claude', message });
      state.conversationHistory.push({ speaker: 'user', message: response });

      console.error(`[${conversationId}] User responded: ${response.substring(0, 50)}...`);

      return { conversationId, response };
    } catch (error) {
      this.activeConversations.delete(conversationId);
      throw error;
    }
  }

  /**
   * Continue an existing conversation
   */
  async continueConversation(conversationId: string, message: string): Promise<string> {
    const state = this.activeConversations.get(conversationId);
    if (!state || !state.active) {
      throw new Error(`No active conversation: ${conversationId}`);
    }

    console.error(`[${conversationId}] Continuing conversation: ${message.substring(0, 50)}...`);

    // Send follow-up message
    await this.telegram.sendMessage(`🤖 *Claude:*\n${message}`);

    // Wait for response
    const response = await this.telegram.waitForResponse();

    state.conversationHistory.push({ speaker: 'claude', message });
    state.conversationHistory.push({ speaker: 'user', message: response });

    console.error(`[${conversationId}] User responded: ${response.substring(0, 50)}...`);

    return response;
  }

  /**
   * Send a message without waiting for response (notification)
   */
  async notify(conversationId: string, message: string): Promise<void> {
    const state = this.activeConversations.get(conversationId);
    if (!state || !state.active) {
      throw new Error(`No active conversation: ${conversationId}`);
    }

    console.error(`[${conversationId}] Sending notification: ${message.substring(0, 50)}...`);

    await this.telegram.sendMessage(`🤖 *Claude:*\n${message}`);
    state.conversationHistory.push({ speaker: 'claude', message });
  }

  /**
   * End a conversation
   */
  async endConversation(conversationId: string, message: string): Promise<{ durationSeconds: number }> {
    const state = this.activeConversations.get(conversationId);
    if (!state) {
      throw new Error(`No conversation found: ${conversationId}`);
    }

    console.error(`[${conversationId}] Ending conversation: ${message.substring(0, 50)}...`);

    // Send closing message
    await this.telegram.sendMessage(`🤖 *Claude:*\n${message}\n\n_Conversation ended._`);

    state.active = false;
    const durationSeconds = Math.round((Date.now() - state.startTime) / 1000);
    this.activeConversations.delete(conversationId);

    return { durationSeconds };
  }

  /**
   * Clean up resources
   */
  shutdown(): void {
    for (const conversationId of this.activeConversations.keys()) {
      this.activeConversations.delete(conversationId);
    }
  }
}
