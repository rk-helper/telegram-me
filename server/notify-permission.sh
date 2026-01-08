#!/bin/bash
# Permission request handler - text replies (yes/no)

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // "unknown tool"')
TOOL_INPUT=$(echo "$INPUT" | jq -c '.tool_input // {}')

BOT_TOKEN="${CALLME_TELEGRAM_BOT_TOKEN}"
CHAT_ID="${CALLME_TELEGRAM_CHAT_ID}"
TIMEOUT="${CALLME_RESPONSE_TIMEOUT_MS:-180000}"
TIMEOUT_SEC=$((TIMEOUT / 1000))

if [ -z "$BOT_TOKEN" ] || [ -z "$CHAT_ID" ]; then
  echo '{}'
  exit 0
fi

# Format action description
case "$TOOL_NAME" in
  Write|Edit)
    FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path // "unknown file"')
    ACTION_DESC="modify file: $FILE_PATH"
    ;;
  Bash)
    COMMAND=$(echo "$TOOL_INPUT" | jq -r '.command // "unknown"' | head -c 150)
    ACTION_DESC="run: $COMMAND"
    ;;
  *)
    ACTION_DESC="use $TOOL_NAME"
    ;;
esac

# Clear pending updates
OFFSET_RESPONSE=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=-1&limit=1")
LAST_UPDATE_ID=$(echo "$OFFSET_RESPONSE" | jq -r '.result[-1].update_id // 0')
OFFSET=$((LAST_UPDATE_ID + 1))

# Send permission request
MESSAGE="🔐 Permission Request

Claude wants to: $ACTION_DESC

Reply: yes or no"

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
    curl -s "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
      -H "Content-Type: application/json" \
      -d "$(jq -n --arg chat_id "$CHAT_ID" --arg text "⏰ Timeout - respond in Claude Code" '{chat_id: $chat_id, text: $text}')" \
      > /dev/null 2>&1
    echo '{}'
    exit 0
  fi

  UPDATES=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${OFFSET}&timeout=5")

  RESPONSE=$(echo "$UPDATES" | jq -r --arg chat_id "$CHAT_ID" '
    .result[] | select(.message.chat.id == ($chat_id | tonumber)) | .message.text // empty
  ' | head -1 | tr '[:upper:]' '[:lower:]')

  NEW_OFFSET=$(echo "$UPDATES" | jq -r '.result[-1].update_id // empty')
  if [ -n "$NEW_OFFSET" ]; then
    OFFSET=$((NEW_OFFSET + 1))
  fi

  if [ -n "$RESPONSE" ]; then
    case "$RESPONSE" in
      yes|y|ok|approve|sure|go|да)
        curl -s "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
          -H "Content-Type: application/json" \
          -d "$(jq -n --arg chat_id "$CHAT_ID" --arg text "✅ Approved" '{chat_id: $chat_id, text: $text}')" \
          > /dev/null 2>&1
        echo '{"behavior": "allow"}'
        exit 0
        ;;
      no|n|deny|reject|stop|нет)
        curl -s "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
          -H "Content-Type: application/json" \
          -d "$(jq -n --arg chat_id "$CHAT_ID" --arg text "❌ Denied" '{chat_id: $chat_id, text: $text}')" \
          > /dev/null 2>&1
        echo '{"behavior": "deny", "message": "User denied via Telegram"}'
        exit 0
        ;;
    esac
  fi

  sleep 1
done
