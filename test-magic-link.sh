#!/bin/bash
# Quick test script for magic link generation

EMAIL="${1:-oryaron38@gmail.com}"
REDIRECT="${2:-http://localhost:3001/app/admin}"

echo "🔗 Generating magic link for: $EMAIL"
echo "📍 Redirect to: $REDIRECT"
echo ""

RESPONSE=$(curl -s -X POST http://localhost:3001/api/superadmin/users/send-magic-link \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"redirectTo\":\"$REDIRECT\"}")

echo "$RESPONSE" | python3 -m json.tool

echo ""
echo "---"
echo ""

# Extract magic link
MAGIC_LINK=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('magicLink', 'N/A'))")

if [ "$MAGIC_LINK" != "N/A" ]; then
  echo "✅ Magic link generated successfully!"
  echo ""
  echo "🔗 Copy this link and open in incognito browser:"
  echo ""
  echo "$MAGIC_LINK"
  echo ""
  echo "📋 Link copied to clipboard (if pbcopy available)"
  echo "$MAGIC_LINK" | pbcopy 2>/dev/null || echo "(pbcopy not available - copy manually)"
else
  echo "❌ Failed to generate magic link"
  echo "Check the error message above"
fi




