#!/bin/bash
# Generate Magic Link for the onboarded user

echo "🔗 Generating magic link for oryaron38@gmail.com..."
echo ""

response=$(curl -s -X POST http://localhost:3001/api/debug/generate-magic-link \
  -H "Content-Type: application/json" \
  -d '{"email": "oryaron38@gmail.com"}')

echo "$response" | jq -r '.magic_link // .error // "Unknown error"'
echo ""
echo "✅ Copy this link and paste it in your browser to login as the new company owner."

