#!/bin/bash

# Быстрый скрипт для коммита изменений

set -e

echo "🔍 Checking git status..."
git status

echo ""
echo "📝 Adding changes..."
git add apps/site/package.json

echo ""
echo "💾 Creating commit..."
git commit -m "fix(site): move Tailwind CSS dependencies to production deps for Vercel build

- Moved tailwindcss from devDependencies to dependencies
- Moved postcss from devDependencies to dependencies
- Moved autoprefixer from devDependencies to dependencies

This fixes the 'Cannot find module tailwindcss' error in Vercel builds.
Vercel does not install devDependencies in production by default."

echo ""
echo "🚀 Pushing to remote..."
git push

echo ""
echo "✅ Done! Vercel will automatically start a new deployment."
echo "Check deployment status at: https://vercel.com/dashboard"

