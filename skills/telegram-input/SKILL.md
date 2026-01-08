# Telegram Input Skill

## Description
Message the user on Telegram for real-time conversations. Use this when you need input, want to report on completed work, or need to discuss next steps.

## When to Use This Skill

**Use when:**
- You've **completed a significant task** and want to report status and ask what's next
- You need **user input** for complex decisions
- A question requires **back-and-forth discussion** to fully understand
- You're **blocked** and need urgent clarification to proceed

**Do NOT use for:**
- Simple yes/no questions (use text instead)
- Routine status updates that don't need discussion
- Information the user has already provided

## Tools

### `send_message`
Send a message to the user via Telegram and wait for their response.

**Parameters:**
- `message` (string): What you want to say. Be clear and conversational.

**Returns:**
- Conversation ID and the user's response

### `continue_conversation`
Continue an active conversation with a follow-up message.

**Parameters:**
- `conversation_id` (string): The conversation ID from `send_message`
- `message` (string): Your follow-up message

**Returns:**
- The user's response

### `notify_user`
Send a notification without waiting for a response.

**Parameters:**
- `conversation_id` (string): The conversation ID from `send_message`
- `message` (string): The notification message

### `end_conversation`
End an active conversation with a closing message.

**Parameters:**
- `conversation_id` (string): The conversation ID from `send_message`
- `message` (string): Your closing message

## Example Usage

**Simple conversation:**
```
1. send_message: "Hey! I finished the auth system. Should I move on to the API endpoints?"
2. User responds: "Yes, go ahead"
3. end_conversation: "Perfect! I'll start on the API endpoints. Talk soon!"
```

**Multi-turn conversation:**
```
1. send_message: "I'm working on payments. Should I use Stripe or PayPal?"
2. User: "Use Stripe"
3. continue_conversation: "Got it. Do you want the full checkout flow or just a simple button?"
4. User: "Full checkout flow"
5. end_conversation: "Awesome, I'll build the full Stripe checkout!"
```

## Best Practices

1. **Be conversational** - Write naturally, like a real chat
2. **Provide context** - Explain what you've done before asking questions
3. **Offer clear options** - Make decisions easy with specific choices
4. **Always end gracefully** - Say goodbye and state what you'll do next
