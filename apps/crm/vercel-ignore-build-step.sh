#!/bin/bash

# Vercel Ignored Build Step для CRM
# Деплоим только если были изменения в apps/crm или shared packages

echo "Checking if build should proceed for CRM..."

# Получаем список измененных файлов
if [ -z "$VERCEL_GIT_PREVIOUS_SHA" ]; then
  echo "No previous commit found, proceeding with build"
  exit 1
fi

# Проверяем изменения в apps/crm, packages/shared-types, или корневых конфигах
git diff --name-only $VERCEL_GIT_PREVIOUS_SHA $VERCEL_GIT_COMMIT_SHA | grep -E "^apps/crm/|^packages/shared-types/|^package.json|^turbo.json"

if [ $? -eq 0 ]; then
  echo "Changes detected in CRM app or shared dependencies, proceeding with build"
  exit 1
else
  echo "No changes in CRM app, skipping build"
  exit 0
fi

