#!/bin/bash

# Vercel Ignored Build Step для CRM
# Деплоим только если были изменения в apps/crm или shared packages

echo "Checking if build should proceed for CRM..."

if [ -z "$VERCEL_GIT_PREVIOUS_SHA" ]; then
  echo "No previous commit found, proceeding with build"
  exit 1
fi

if [ "$VERCEL_GIT_PREVIOUS_SHA" = "$VERCEL_GIT_COMMIT_SHA" ]; then
  echo "Same commit redeployed — proceeding with build to pick up env var changes"
  exit 1
fi

# Vercel uses shallow clones — fetch enough history to include the previous SHA
git fetch --depth=100 origin 2>/dev/null || true

DIFF_OUTPUT=$(git diff --name-only "$VERCEL_GIT_PREVIOUS_SHA" "$VERCEL_GIT_COMMIT_SHA" 2>/dev/null)
DIFF_EXIT=$?

if [ $DIFF_EXIT -ne 0 ] || [ -z "$DIFF_OUTPUT" ]; then
  echo "git diff failed or returned empty (shallow clone) — proceeding with build to be safe"
  exit 1
fi

echo "$DIFF_OUTPUT" | grep -qE "^apps/crm/|^packages/shared-types/|^package\.json|^turbo\.json"

if [ $? -eq 0 ]; then
  echo "Changes detected in CRM app or shared dependencies, proceeding with build"
  exit 1
else
  echo "No changes in CRM app, skipping build"
  exit 0
fi




