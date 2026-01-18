#!/bin/bash

echo "=== Checking apps/site/.env.local ==="
echo ""

if [ ! -f "apps/site/.env.local" ]; then
  echo "❌ File apps/site/.env.local does NOT exist"
  echo ""
  echo "Creating template..."
  cat > apps/site/.env.local << 'EOF'
# AWS S3 Configuration
NEXT_PUBLIC_AWS_S3_BUCKET_NAME=pashkovsky-gallery
NEXT_PUBLIC_AWS_S3_REGION=eu-north-1

# AWS Credentials (replace with your actual keys)
AWS_ACCESS_KEY_ID=AKIA_YOUR_KEY_HERE
AWS_SECRET_ACCESS_KEY=YOUR_SECRET_KEY_HERE
EOF
  echo "✅ Created apps/site/.env.local"
  echo ""
  echo "⚠️  IMPORTANT: Edit this file and add your real AWS credentials:"
  echo "   nano apps/site/.env.local"
  echo ""
  echo "Then restart server: npm run dev"
  exit 0
fi

echo "✅ apps/site/.env.local exists"
echo ""
echo "Contents:"
cat apps/site/.env.local
echo ""
echo ""

# Check for required variables
MISSING=0

if ! grep -q "NEXT_PUBLIC_AWS_S3_BUCKET_NAME" apps/site/.env.local; then
  echo "❌ NEXT_PUBLIC_AWS_S3_BUCKET_NAME is missing"
  MISSING=1
else
  echo "✅ NEXT_PUBLIC_AWS_S3_BUCKET_NAME is present"
fi

if ! grep -q "NEXT_PUBLIC_AWS_S3_REGION" apps/site/.env.local; then
  echo "❌ NEXT_PUBLIC_AWS_S3_REGION is missing"
  MISSING=1
else
  echo "✅ NEXT_PUBLIC_AWS_S3_REGION is present"
fi

if ! grep -q "AWS_ACCESS_KEY_ID" apps/site/.env.local; then
  echo "❌ AWS_ACCESS_KEY_ID is missing"
  MISSING=1
else
  echo "✅ AWS_ACCESS_KEY_ID is present"
fi

if ! grep -q "AWS_SECRET_ACCESS_KEY" apps/site/.env.local; then
  echo "❌ AWS_SECRET_ACCESS_KEY is missing"
  MISSING=1
else
  echo "✅ AWS_SECRET_ACCESS_KEY is present"
fi

echo ""
if [ $MISSING -eq 1 ]; then
  echo "⚠️  Some variables are missing. Please add them and restart server."
else
  echo "✅ All required variables are present."
  echo ""
  echo "Next: Restart server with: npm run dev"
fi

