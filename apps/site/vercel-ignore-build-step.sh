#!/bin/bash

# Vercel Ignored Build Step для Site
# Деплоим только если были изменения в apps/site или shared packages

echo "Checking if build should proceed for Site..."

# Получаем список измененных файлов
if [ -z "$VERCEL_GIT_PREVIOUS_SHA" ]; then
  echo "No previous commit found, proceeding with build"
  exit 1
fi

# Проверяем изменения в apps/site, packages/shared-types, или корневых конфигах
git diff --name-only $VERCEL_GIT_PREVIOUS_SHA $VERCEL_GIT_COMMIT_SHA | grep -E "^apps/site/|^packages/shared-types/|^package.json|^turbo.json"

if [ $? -eq 0 ]; then
  echo "Changes detected in Site app or shared dependencies, proceeding with build"
  exit 1
else
  echo "No changes in Site app, skipping build"
  exit 0
fi

