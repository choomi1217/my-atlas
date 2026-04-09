#!/bin/bash
# Claude Code Slack notification script
# Usage: claude-slack-notify.sh <stop|notification>

EVENT_TYPE="${1:-stop}"
WEBHOOK_URL="${SLACK_CLAUDE_WEBHOOK_URL}"
SUMMARY_FILE=".claude/session-summary.txt"

if [ -z "$WEBHOOK_URL" ]; then
  exit 0
fi

# Gather dynamic info
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")

# Calculate session duration
CLAUDE_PID=$(pgrep -f "claude" 2>/dev/null | head -1)
if [ -n "$CLAUDE_PID" ]; then
  START_EPOCH=$(ps -o lstart= -p "$CLAUDE_PID" 2>/dev/null | xargs -I{} date -j -f "%a %b %d %T %Y" "{}" "+%s" 2>/dev/null || echo "")
  if [ -n "$START_EPOCH" ]; then
    NOW_EPOCH=$(date "+%s")
    ELAPSED=$(( (NOW_EPOCH - START_EPOCH) / 60 ))
    DURATION="~${ELAPSED}min"
  else
    DURATION="-"
  fi
else
  DURATION="-"
fi

if [ "$EVENT_TYPE" = "stop" ]; then
  # Read session summary written by Claude
  if [ -f "$SUMMARY_FILE" ]; then
    SUMMARY=$(cat "$SUMMARY_FILE" | head -20)
    rm -f "$SUMMARY_FILE"
  else
    SUMMARY="(No summary available)"
  fi

  # Escape for JSON
  SUMMARY_ESCAPED=$(echo "$SUMMARY" | sed 's/\\/\\\\/g; s/"/\\"/g' | awk '{printf "%s\\n", $0}' | sed '$ s/\\n$//')

  PAYLOAD=$(cat <<EOF
{
  "blocks": [
    {
      "type": "header",
      "text": { "type": "plain_text", "text": "Claude Code session completed" }
    },
    {
      "type": "section",
      "fields": [
        { "type": "mrkdwn", "text": "*Branch:*\n${BRANCH}" },
        { "type": "mrkdwn", "text": "*Duration:*\n${DURATION}" }
      ]
    },
    {
      "type": "section",
      "text": { "type": "mrkdwn", "text": "${SUMMARY_ESCAPED}" }
    }
  ]
}
EOF
)

elif [ "$EVENT_TYPE" = "notification" ]; then
  LAST_COMMIT=$(git log -1 --format="%s" 2>/dev/null || echo "unknown")

  PAYLOAD=$(cat <<EOF
{
  "blocks": [
    {
      "type": "header",
      "text": { "type": "plain_text", "text": "Claude Code waiting for approval" }
    },
    {
      "type": "section",
      "fields": [
        { "type": "mrkdwn", "text": "*Branch:*\n${BRANCH}" },
        { "type": "mrkdwn", "text": "*Last commit:*\n${LAST_COMMIT}" }
      ]
    }
  ]
}
EOF
)
fi

curl -s -X POST "$WEBHOOK_URL" \
  -H 'Content-Type: application/json' \
  -d "$PAYLOAD" > /dev/null 2>&1 || true
