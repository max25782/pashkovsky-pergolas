#!/bin/bash

echo "=== Copying AWS Keys from CRM to Site ==="
echo ""

# Check if CRM .env.local exists
if [ ! -f "apps/crm/.env.local" ]; then
  echo "❌ apps/crm/.env.local not found"
  exit 1
fi

echo "✅ Found apps/crm/.env.local"
echo ""

# Extract AWS keys from CRM
AWS_ACCESS_KEY_ID=$(grep "^AWS_ACCESS_KEY_ID=" apps/crm/.env.local | cut -d= -f2-)
AWS_SECRET_ACCESS_KEY=$(grep "^AWS_SECRET_ACCESS_KEY=" apps/crm/.env.local | cut -d= -f2-)
AWS_S3_REGION=$(grep "^AWS_S3_REGION=" apps/crm/.env.local | cut -d= -f2-)
AWS_S3_BUCKET_NAME=$(grep "^AWS_S3_BUCKET_NAME=" apps/crm/.env.local | cut -d= -f2-)

# Fallback values
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

echo "Found AWS credentials:"
echo "  AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID:0:10}***"
echo "  AWS_SECRET_ACCESS_KEY: ***"
echo "  AWS_S3_REGION: $AWS_S3_REGION"
echo "  AWS_S3_BUCKET_NAME: $AWS_S3_BUCKET_NAME"
echo ""

# Create apps/site/.env.local if it doesn't exist
if [ ! -f "apps/site/.env.local" ]; then
  echo "Creating apps/site/.env.local..."
  cat > apps/site/.env.local << EOF
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
AWS_S3_REGION=$AWS_S3_REGION

# Gallery bucket (public images)
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
  
  # Remove old AWS keys
  sed -i.bak '/^AWS_ACCESS_KEY_ID=/d' apps/site/.env.local
  sed -i.bak '/^AWS_SECRET_ACCESS_KEY=/d' apps/site/.env.local
  sed -i.bak '/^AWS_S3_REGION=/d' apps/site/.env.local
  sed -i.bak '/^NEXT_PUBLIC_AWS_S3_BUCKET_NAME=/d' apps/site/.env.local
  sed -i.bak '/^NEXT_PUBLIC_AWS_S3_REGION=/d' apps/site/.env.local
  
  # Add new AWS keys
  cat >> apps/site/.env.local << EOF

# AWS S3 Configuration (updated $(date))
AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
AWS_S3_REGION=$AWS_S3_REGION
NEXT_PUBLIC_AWS_S3_BUCKET_NAME=$AWS_S3_BUCKET_NAME
NEXT_PUBLIC_AWS_S3_REGION=$AWS_S3_REGION
EOF
  
  # Clean up
  rm -f apps/site/.env.local.bak
  
  echo "✅ Updated apps/site/.env.local"
fi

echo ""
echo "=== Done! Now restart the dev server ==="
echo ""
echo "1. Kill the current server (Ctrl+C in the terminal running 'npm run dev')"
echo "2. Run: npm run dev"
echo "3. Open: http://localhost:3000/he/railings"
echo ""
echo "Images should load from S3!"

