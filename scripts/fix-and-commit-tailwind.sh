#!/bin/bash
# Быстрый фикс: коммит + проверка что всё правильно

set -e

echo "📋 Step 1: Checking current git status..."
git status --short

echo ""
echo "📦 Step 2: Updating npm lockfile..."
cd /Users/user/Downloads/pashkovsky-pergolas_starter
npm install

echo ""
echo "📝 Step 3: Checking what changed..."
git status --short

echo ""
echo "✅ Step 4: Adding all changes..."
git add apps/site/package.json package-lock.json

echo ""
echo "💾 Step 5: Creating commit..."
git commit -m "fix(site): move Tailwind CSS to dependencies for Vercel build

Problem: Vercel fails with 'Cannot find module tailwindcss'
Cause: tailwindcss was in devDependencies, Vercel doesn't install dev deps

Solution:
- Move tailwindcss to dependencies in apps/site/package.json
- Move postcss to dependencies in apps/site/package.json  
- Move autoprefixer to dependencies in apps/site/package.json
- Update package-lock.json

This ensures these build-time dependencies are available in production."

echo ""
echo "🚀 Step 6: Pushing to remote..."
git push

echo ""
echo "✅ DONE! Now:"
echo "1. Go to Vercel Dashboard"
echo "2. Wait ~30 seconds for auto-deployment"
echo "3. Or manually: Deployments → Redeploy → Clear Build Cache"
echo ""
echo "The new deployment should use the updated package.json with tailwindcss in dependencies."

