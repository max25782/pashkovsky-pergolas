#!/bin/bash

echo "================================"
echo "Installing Redis Client"
echo "================================"

cd apps/crm

echo "Installing @upstash/redis..."
npm install @upstash/redis

echo ""
echo "✅ Installation complete!"
echo ""
echo "Next steps:"
echo "1. Create free Redis database: https://console.upstash.com/"
echo "2. Add credentials to .env.local:"
echo "   UPSTASH_REDIS_REST_URL=https://..."
echo "   UPSTASH_REDIS_REST_TOKEN=..."
echo "3. Restart CRM server"
echo ""
echo "See: REDIS_SETUP.md for detailed instructions"
echo "================================"

