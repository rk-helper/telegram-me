# Telegram Me

**Minimal plugin that lets Claude Code message you on Telegram.**

Start a task, walk away. Telegram pings you when Claude is done, stuck, or needs a decision.

- **Dead simple** - Just one env var: your bot token
- **Multi-turn conversations** - Chat through decisions naturally
- **No dependencies** - Just Telegram, nothing else
- **Free** - Telegram API has no fees

---

## Quick Start

### 1. Create a Telegram Bot

1. Open Telegram and message [@BotFather](https://t.me/botfather)
2. Send `/newbot` and follow the prompts
3. Copy the **Bot Token** you receive

### 2. Set Environment Variable

Add to `~/.claude/settings.json`:

```json
{
  "env": {
    "CALLME_TELEGRAM_BOT_TOKEN": "123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
  }
}
```

### 3. Install Plugin

```bash
/plugin marketplace add rk-helper/telegram-me
/plugin install telegram-me@telegram-me
```

Restart Claude Code. Done!

---

## How It Works

```
Claude Code                    Telegram Me MCP Server
    │                                │
    │  "I finished the feature..."   │
    ▼                                ▼
Plugin ────stdio──────────────► MCP Server
                                     │
                                     ▼
                               Telegram Bot API
                                     │
                                     ▼
                               Your Phone buzzes
                               You reply
                               Response returns to Claude
```

When Claude needs your input, it waits for you to message the bot. Once you send any message, the conversation begins.

---

## Tools

### `send_message`
Send a message and wait for response.

```typescript
const { conversationId, response } = await send_message({
  message: "Hey! I finished the auth system. What should I work on next?"
});
```

### `continue_conversation`
Continue with follow-up questions.

```typescript
const response = await continue_conversation({
  conversation_id: conversationId,
  message: "Got it. Should I add rate limiting too?"
});
```

### `notify_user`
Send a notification without waiting for response.

```typescript
await notify_user({
  conversation_id: conversationId,
  message: "Searching for that information..."
});
```

### `end_conversation`
End the conversation.

```typescript
await end_conversation({
  conversation_id: conversationId,
  message: "Perfect, I'll get started. Talk soon!"
});
```

---

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CALLME_TELEGRAM_BOT_TOKEN` | Yes | - | Bot token from BotFather |
| `CALLME_RESPONSE_TIMEOUT_MS` | No | `180000` | Response timeout (3 min) |

---

## Troubleshooting

### Claude doesn't use the tool
1. Check `CALLME_TELEGRAM_BOT_TOKEN` is set in `~/.claude/settings.json`
2. Restart Claude Code after installing
3. Try: "Message me on Telegram when you're done"

### Bot doesn't respond
1. Make sure you messaged the bot first to start the chat
2. Check the MCP server logs with `claude --debug`

---

## Development

```bash
cd server
bun install
bun run dev
```

---

## License

MIT
