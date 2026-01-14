#!/bin/bash
ENV_FILE="apps/crm/.env.local"
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ File $ENV_FILE not found!"
    exit 1
fi

ACCESS_KEY=$(grep "^AWS_ACCESS_KEY_ID=" "$ENV_FILE" | cut -d'=' -f2 | tr -d '"' | tr -d "'" | xargs)
if [[ "$ACCESS_KEY" == AAKIA* ]]; then
    echo "⚠️  ERROR: Access Key starts with 'AAKIA' (double A)!"
    echo "   Should be 'AKIA' (single A)"
    echo "   Fix: Remove extra 'A' from AWS_ACCESS_KEY_ID in $ENV_FILE"
elif [[ "$ACCESS_KEY" == AKIA* ]]; then
    echo "✅ Access Key format correct"
else
    echo "⚠️  Access Key not found or invalid format"
fi
