#!/bin/bash
# Batch configure Cloudflare Email Routing for multiple domains
#
# Usage:
#   export CF_API_TOKEN="your-token"
#   export CF_ACCOUNT_ID="your-account-id"
#   export TARGET_WORKER="domain-inbox"
#   ./configure-domains.sh domains.txt
#
# domains.txt format: one domain per line
#   example.com
#   example.org

set -euo pipefail

CF_API="${CF_API:-https://api.cloudflare.com/client/v4}"
CF_API_TOKEN="${CF_API_TOKEN:?CF_API_TOKEN required}"
CF_ACCOUNT_ID="${CF_ACCOUNT_ID:?CF_ACCOUNT_ID required}"
TARGET_WORKER="${TARGET_WORKER:-domain-inbox}"
DOMAINS_FILE="${1:?Usage: $0 <domains-file>}"

if [ ! -f "$DOMAINS_FILE" ]; then
  echo "Error: $DOMAINS_FILE not found"
  exit 1
fi

# Function to list Cloudflare zones (the domains in your account)
get_zones() {
  curl -s -X GET "$CF_API/zones?per_page=100" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json"
}

# Enable Email Routing for a zone
enable_email_routing() {
  local zone_id="$1"
  curl -s -X POST "$CF_API/zones/$zone_id/email/routing/enable" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" > /dev/null
  echo "  -> Email Routing enabled"
}

# Create a catch-all rule that sends to the Worker
create_catch_all() {
  local zone_id="$1"
  local domain="$2"
  local worker="$3"

  # First, delete existing catch-all rules
  local rules=$(curl -s -X GET "$CF_API/zones/$zone_id/email/routing/rules" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json")

  local catch_all_ids=$(echo "$rules" | jq -r '.result[] | select(.matchers[].type == "all") | .id' 2>/dev/null || echo "")
  for rid in $catch_all_ids; do
    curl -s -X DELETE "$CF_API/zones/$zone_id/email/routing/rules/$rid" \
      -H "Authorization: Bearer $CF_API_TOKEN" \
      -H "Content-Type: application/json" > /dev/null
  done

  # Create new catch-all → Worker
  local body=$(cat <<-BODY
{
  "actions": [
    {
      "type": "worker",
      "value": [
        "$worker"
      ]
    }
  ],
  "matchers": [
    {
      "type": "all"
    }
  ],
  "enabled": true,
  "name": "Catch-all → Worker ($domain)"
}
BODY
  )

  curl -s -X POST "$CF_API/zones/$zone_id/email/routing/rules" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data "$body" | jq -r '.success'
}

echo "=== Fetching zones from Cloudflare ==="
ZONES_JSON=$(get_zones)
echo "Found $(echo "$ZONES_JSON" | jq '.result | length') zones total"

echo ""
echo "=== Processing domains ==="
while IFS= read -r domain || [ -n "$domain" ]; do
  # Skip empty lines and comments
  [[ -z "$domain" || "$domain" =~ ^# ]] && continue

  domain=$(echo "$domain" | tr '[:upper:]' '[:lower:]' | xargs)
  echo ""
  echo "--- $domain ---"

  # Find zone ID for this domain
  ZONE_ID=$(echo "$ZONES_JSON" | jq -r --arg d "$domain" '.result[] | select(.name == $d) | .id' 2>/dev/null)

  if [ -z "$ZONE_ID" ]; then
    echo "  ⚠ Domain not found in Cloudflare zones. Skipping."
    echo "  Make sure $domain is added to Cloudflare first."
    continue
  fi

  echo "  Zone ID: $ZONE_ID"

  # Enable Email Routing
  enable_email_routing "$ZONE_ID"

  # Create catch-all rule
  echo "  Creating catch-all rule -> $TARGET_WORKER..."
  RESULT=$(create_catch_all "$ZONE_ID" "$domain" "$TARGET_WORKER")
  if [ "$RESULT" = "true" ]; then
    echo "  ✅ Catch-all rule created"
  else
    echo "  ❌ Failed to create catch-all rule"
  fi
done < "$DOMAINS_FILE"

echo ""
echo "=== Done ==="
