#!/bin/bash

# Vercel Ignored Build Step для Site
# Деплоим только если были изменения в apps/site или shared packages

echo "Checking if build should proceed for Site..."

# Получаем список измененных файлов
if [ -z "$VERCEL_GIT_PREVIOUS_SHA" ] || [ -z "$VERCEL_GIT_COMMIT_SHA" ]; then
  echo "No previous commit found, proceeding with build"
  exit 1
fi

# Проверяем что коммиты существуют
if ! git cat-file -e "$VERCEL_GIT_PREVIOUS_SHA" 2>/dev/null; then
  echo "Previous commit $VERCEL_GIT_PREVIOUS_SHA not found, proceeding with build"
  exit 1
fi

if ! git cat-file -e "$VERCEL_GIT_COMMIT_SHA" 2>/dev/null; then
  echo "Current commit $VERCEL_GIT_COMMIT_SHA not found, proceeding with build"
  exit 1
fi

# Проверяем изменения в apps/site, packages/shared-types, или корневых конфигах
CHANGES=$(git diff --name-only $VERCEL_GIT_PREVIOUS_SHA $VERCEL_GIT_COMMIT_SHA 2>/dev/null | grep -E "^apps/site/|^packages/shared-types/|^package.json|^turbo.json")

if [ $? -eq 0 ] && [ -n "$CHANGES" ]; then
  echo "Changes detected in Site app or shared dependencies, proceeding with build"
  exit 1
else
  echo "No changes in Site app, skipping build"
  exit 0
fi




