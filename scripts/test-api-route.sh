#!/bin/bash

echo "=== Testing S3 Gallery API Route ==="
echo ""

# Check if server is running
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo "❌ Server is not running on localhost:3000"
  echo ""
  echo "Start the server first:"
  echo "  npm run dev"
  exit 1
fi

echo "✅ Server is running"
echo ""

# Test API route
echo "📡 Testing API route: /api/gallery/from-shetah"
echo ""

RESPONSE=$(curl -s http://localhost:3000/api/gallery/from-shetah)

# Check if response is valid JSON
if ! echo "$RESPONSE" | jq . > /dev/null 2>&1; then
  echo "❌ API returned invalid JSON"
  echo ""
  echo "Response:"
  echo "$RESPONSE"
  exit 1
fi

# Count items
ITEM_COUNT=$(echo "$RESPONSE" | jq '.items | length')

echo "✅ API returned valid JSON"
echo ""
echo "Items count: $ITEM_COUNT"
echo ""

if [ "$ITEM_COUNT" -gt 0 ]; then
  echo "✅ SUCCESS! API returned $ITEM_COUNT items from S3"
  echo ""
  echo "Sample items:"
  echo "$RESPONSE" | jq '.items[0:3]'
  echo ""
  echo "Now test the page:"
  echo "  http://localhost:3000/he/fromShetah"
else
  echo "⚠️  WARNING: API returned 0 items"
  echo ""
  echo "This means either:"
  echo "  1. AWS credentials are missing/invalid in apps/site/.env.local"
  echo "  2. S3 folder 'images/fromShetah/' is empty"
  echo "  3. API is falling back to static data (which is empty)"
  echo ""
  echo "Check server logs for errors like:"
  echo "  [from-shetah API] Missing AWS credentials"
  echo "  [from-shetah API] Error: ..."
fi

echo ""
echo "=== Check Browser Console ==="
echo "Open http://localhost:3000/he/fromShetah and look for:"
echo "  [FromShetah Page] Loaded from API: X items"
echo "  [MediaGallery] Received items: X"
echo "  [MediaGallery] Videos: X Images: X"

