#!/bin/bash
# Stop hook - notify user that Claude finished and ask what's next

# Read from settings.json
SETTINGS_FILE="$HOME/.claude/settings.json"
BOT_TOKEN=$(jq -r '.env.CALLME_TELEGRAM_BOT_TOKEN // empty' "$SETTINGS_FILE" 2>/dev/null)
CHAT_ID=$(jq -r '.env.CALLME_TELEGRAM_CHAT_ID // empty' "$SETTINGS_FILE" 2>/dev/null)
TIMEOUT="${CALLME_RESPONSE_TIMEOUT_MS:-180000}"
TIMEOUT_SEC=$((TIMEOUT / 1000))

if [ -z "$BOT_TOKEN" ] || [ -z "$CHAT_ID" ]; then
  exit 0
fi

# Read stop reason from stdin
INPUT=$(cat)
STOP_REASON=$(echo "$INPUT" | jq -r '.stop_reason // "completed"' 2>/dev/null)

# Clear pending updates
OFFSET_RESPONSE=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=-1&limit=1")
LAST_UPDATE_ID=$(echo "$OFFSET_RESPONSE" | jq -r '.result[-1].update_id // 0')
OFFSET=$((LAST_UPDATE_ID + 1))

# Send notification
MESSAGE="✅ Claude finished ($STOP_REASON)

What would you like me to do next?"

curl -s "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg chat_id "$CHAT_ID" --arg text "$MESSAGE" '{chat_id: $chat_id, text: $text}')" \
  > /dev/null 2>&1

# Wait for response
START_TIME=$(date +%s)
while true; do
  CURRENT_TIME=$(date +%s)
  ELAPSED=$((CURRENT_TIME - START_TIME))

  if [ $ELAPSED -ge $TIMEOUT_SEC ]; then
    exit 0
  fi

  UPDATES=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${OFFSET}&timeout=5")

  RESPONSE=$(echo "$UPDATES" | jq -r --arg chat_id "$CHAT_ID" '
    .result[] | select(.message.chat.id == ($chat_id | tonumber)) | .message.text // empty
  ' | head -1)

  NEW_OFFSET=$(echo "$UPDATES" | jq -r '.result[-1].update_id // empty')
  if [ -n "$NEW_OFFSET" ]; then
    OFFSET=$((NEW_OFFSET + 1))
  fi

  if [ -n "$RESPONSE" ]; then
    # Return the user's response as the new prompt
    echo "$RESPONSE"
    exit 0
  fi

  sleep 1
done
