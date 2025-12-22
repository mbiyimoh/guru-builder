#!/bin/bash
# Inngest Run Monitor
# Usage: ./scripts/inngest-monitor.sh [count]
# Queries the local Inngest dev server for recent runs and their status

COUNT=${1:-5}
INNGEST_URL="${INNGEST_URL:-http://localhost:8288}"

echo "🔍 Querying Inngest runs from $INNGEST_URL..."
echo ""

# Query runs via GraphQL
RESULT=$(curl -s -X POST "$INNGEST_URL/v0/gql" \
  -H "Content-Type: application/json" \
  -d "{
    \"query\": \"query { runs(first: $COUNT, filter: { from: \\\"2024-01-01T00:00:00Z\\\" }, orderBy: [{ field: QUEUED_AT, direction: DESC }]) { edges { node { id status endedAt output function { name } } } } }\"
  }")

# Check if we got a response
if [ -z "$RESULT" ]; then
  echo "❌ Failed to connect to Inngest at $INNGEST_URL"
  echo "   Make sure the Inngest dev server is running: npx inngest-cli dev"
  exit 1
fi

# Parse and display runs
echo "$RESULT" | jq -r '
  .data.runs.edges[] |
  .node |
  "───────────────────────────────────────────────────────────────",
  "📦 Run: \(.id)",
  "   Function: \(.function.name)",
  "   Status: \(if .status == "FAILED" then "❌ FAILED" elif .status == "COMPLETED" then "✅ COMPLETED" elif .status == "RUNNING" then "⏳ RUNNING" else .status end)",
  "   Ended: \(.endedAt // "Still running...")",
  if .status == "FAILED" then
    "   Error: \(.output | fromjson | .message | .[0:200])..."
  else
    ""
  end
' 2>/dev/null

echo "───────────────────────────────────────────────────────────────"
echo ""
echo "💡 Tip: Use './scripts/inngest-monitor.sh 10' to see more runs"
echo "   Or open http://localhost:8288 for the full UI"
