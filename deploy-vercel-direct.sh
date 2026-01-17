#!/bin/bash
# Deploy to Vercel directly without GitHub

set -e

echo "🚀 Deploying Site to Vercel (without GitHub)..."
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
fi

# Navigate to site directory
cd /Users/user/Downloads/pashkovsky-pergolas_starter/apps/site

echo "📍 Current directory: $(pwd)"
echo ""

# Deploy to production
echo "🚀 Starting deployment..."
vercel --prod --yes

echo ""
echo "✅ Deployment complete!"
echo "Check your Vercel dashboard for the deployment URL."

