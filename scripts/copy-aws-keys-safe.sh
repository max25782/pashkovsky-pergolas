#!/bin/bash

echo "=== Copying CORRECT AWS Keys from CRM to Site ==="
echo ""

# Check if CRM .env.local exists
if [ ! -f "apps/crm/.env.local" ]; then
  echo "❌ apps/crm/.env.local not found"
  exit 1
fi

echo "✅ Found apps/crm/.env.local"
echo ""

# Extract AWS keys from CRM
echo "📋 Reading AWS keys from CRM..."
AWS_ACCESS_KEY_ID=$(grep "^AWS_ACCESS_KEY_ID=" apps/crm/.env.local | cut -d= -f2-)
AWS_SECRET_ACCESS_KEY=$(grep "^AWS_SECRET_ACCESS_KEY=" apps/crm/.env.local | cut -d= -f2-)
AWS_S3_REGION=$(grep "^AWS_S3_REGION=" apps/crm/.env.local | cut -d= -f2-)
AWS_S3_BUCKET_NAME=$(grep "^AWS_S3_BUCKET_NAME=" apps/crm/.env.local | cut -d= -f2-)

# Defaults
AWS_S3_REGION=${AWS_S3_REGION:-eu-north-1}
AWS_S3_BUCKET_NAME=${AWS_S3_BUCKET_NAME:-pashkovsky-gallery}

if [ -z "$AWS_ACCESS_KEY_ID" ]; then
  echo "❌ AWS_ACCESS_KEY_ID not found in apps/crm/.env.local"
  exit 1
fi

if [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
  echo "❌ AWS_SECRET_ACCESS_KEY not found in apps/crm/.env.local"
  exit 1
fi

echo "✅ Found AWS credentials in CRM:"
echo "   AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID:0:10}***"
echo "   AWS_SECRET_ACCESS_KEY: ***"
echo "   AWS_S3_REGION: $AWS_S3_REGION"
echo "   AWS_S3_BUCKET_NAME: $AWS_S3_BUCKET_NAME"
echo ""

# Check for AAKIA typo
if [[ "$AWS_ACCESS_KEY_ID" == AAKIA* ]]; then
  echo "⚠️  WARNING: Access Key starts with 'AAKIA' (double A)"
  echo "   This is likely a typo - should be 'AKIA' (single A)"
  echo ""
  echo "Fix in apps/crm/.env.local first, then run this script again."
  exit 1
fi

# Update Site .env.local
if [ ! -f "apps/site/.env.local" ]; then
  echo "Creating apps/site/.env.local..."
  cat > apps/site/.env.local << EOF
# AWS S3 Configuration (copied from CRM on $(date))
AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
AWS_S3_REGION=$AWS_S3_REGION
AWS_S3_BUCKET_NAME=$AWS_S3_BUCKET_NAME

# Public bucket for galleries
NEXT_PUBLIC_AWS_S3_BUCKET_NAME=$AWS_S3_BUCKET_NAME
NEXT_PUBLIC_AWS_S3_REGION=$AWS_S3_REGION

# CRM API (for lead form)
NEXT_PUBLIC_CRM_API_URL=https://crm.pashkovsky-group.com
EOF
  echo "✅ Created apps/site/.env.local"
else
  echo "Updating apps/site/.env.local..."
  
  # Backup
  cp apps/site/.env.local apps/site/.env.local.backup
  
  # Remove old AWS keys (macOS-compatible sed)
  sed -i '' '/^AWS_ACCESS_KEY_ID=/d' apps/site/.env.local
  sed -i '' '/^AWS_SECRET_ACCESS_KEY=/d' apps/site/.env.local
  sed -i '' '/^AWS_S3_REGION=/d' apps/site/.env.local
  sed -i '' '/^AWS_S3_BUCKET_NAME=/d' apps/site/.env.local
  sed -i '' '/^NEXT_PUBLIC_AWS_S3_BUCKET_NAME=/d' apps/site/.env.local
  sed -i '' '/^NEXT_PUBLIC_AWS_S3_REGION=/d' apps/site/.env.local
  
  # Add new AWS keys
  cat >> apps/site/.env.local << EOF

# AWS S3 Configuration (copied from CRM on $(date))
AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
AWS_S3_REGION=$AWS_S3_REGION
AWS_S3_BUCKET_NAME=$AWS_S3_BUCKET_NAME
NEXT_PUBLIC_AWS_S3_BUCKET_NAME=$AWS_S3_BUCKET_NAME
NEXT_PUBLIC_AWS_S3_REGION=$AWS_S3_REGION
EOF
  
  echo "✅ Updated apps/site/.env.local"
  echo "   (Backup saved to apps/site/.env.local.backup)"
fi

echo ""
echo "=== ✅ Done! ==="
echo ""
echo "Next steps:"
echo "1. Restart the dev server:"
echo "   - Press Ctrl+C in the terminal running 'npm run dev'"
echo "   - Run: npm run dev"
echo ""
echo "2. Test the API route:"
echo "   curl http://localhost:3000/api/gallery/from-shetah | jq '.items | length'"
echo ""
echo "3. Open the page:"
echo "   http://localhost:3000/he/fromShetah"
echo ""
echo "Expected result: Images load from S3 (not fallback)!"

