#!/bin/bash
# Простой скрипт для коммита изменений

set -e

echo "🔍 Checking git status..."
cd /Users/user/Downloads/pashkovsky-pergolas_starter
git status

echo ""
echo "📝 Adding changes..."
git add apps/site/package.json apps/site/vercel.json

echo ""
echo "💾 Creating commit..."
git commit -m "fix(site): move Tailwind CSS to dependencies for Vercel build

- Move tailwindcss from devDependencies to dependencies
- Move postcss from devDependencies to dependencies  
- Move autoprefixer from devDependencies to dependencies
- Update vercel.json to use --production=false as fallback

Fixes: Cannot find module 'tailwindcss' error in Vercel builds"

echo ""
echo "🚀 Pushing to remote..."
git push

echo ""
echo "✅ DONE! Vercel will automatically deploy in ~30 seconds."
echo "Check: https://vercel.com/dashboard"

