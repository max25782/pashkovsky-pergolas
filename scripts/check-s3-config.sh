#!/bin/bash

echo "=== Checking AWS S3 Configuration ==="
echo ""

# Check if .env.local exists
if [ ! -f "apps/site/.env.local" ]; then
  echo "❌ apps/site/.env.local NOT FOUND"
  echo ""
  echo "Create it with:"
  echo "cat > apps/site/.env.local << 'EOF'"
  echo "NEXT_PUBLIC_AWS_S3_BUCKET_NAME=pashkovsky-gallery"
  echo "NEXT_PUBLIC_AWS_S3_REGION=eu-north-1"
  echo "AWS_ACCESS_KEY_ID=your-access-key-here"
  echo "AWS_SECRET_ACCESS_KEY=your-secret-key-here"
  echo "EOF"
  exit 1
fi

echo "✅ apps/site/.env.local exists"
echo ""

# Check for AWS variables
echo "--- Checking AWS Environment Variables ---"
cd apps/site

if grep -q "NEXT_PUBLIC_AWS_S3_BUCKET_NAME" .env.local; then
  BUCKET=$(grep "NEXT_PUBLIC_AWS_S3_BUCKET_NAME" .env.local | cut -d'=' -f2)
  echo "✅ NEXT_PUBLIC_AWS_S3_BUCKET_NAME = $BUCKET"
else
  echo "❌ NEXT_PUBLIC_AWS_S3_BUCKET_NAME missing"
fi

if grep -q "NEXT_PUBLIC_AWS_S3_REGION" .env.local; then
  REGION=$(grep "NEXT_PUBLIC_AWS_S3_REGION" .env.local | cut -d'=' -f2)
  echo "✅ NEXT_PUBLIC_AWS_S3_REGION = $REGION"
else
  echo "❌ NEXT_PUBLIC_AWS_S3_REGION missing"
fi

if grep -q "AWS_ACCESS_KEY_ID" .env.local; then
  ACCESS_KEY=$(grep "AWS_ACCESS_KEY_ID" .env.local | cut -d'=' -f2)
  echo "✅ AWS_ACCESS_KEY_ID = ${ACCESS_KEY:0:8}... (masked)"
else
  echo "❌ AWS_ACCESS_KEY_ID missing"
fi

if grep -q "AWS_SECRET_ACCESS_KEY" .env.local; then
  echo "✅ AWS_SECRET_ACCESS_KEY = *** (present)"
else
  echo "❌ AWS_SECRET_ACCESS_KEY missing"
fi

echo ""
echo "--- Testing S3 Access ---"

# Test S3 access
if command -v aws &> /dev/null; then
  echo "Testing: aws s3 ls s3://pashkovsky-gallery/images/mestor/"
  aws s3 ls s3://pashkovsky-gallery/images/mestor/ --recursive 2>&1 | head -5
  
  if [ $? -eq 0 ]; then
    echo ""
    echo "✅ S3 access works via AWS CLI"
  else
    echo ""
    echo "❌ S3 access failed"
    echo "Check your AWS credentials in ~/.aws/credentials"
  fi
else
  echo "⚠️  AWS CLI not installed (optional)"
fi

echo ""
echo "--- Next Steps ---"
echo "1. Ensure all 4 variables above are ✅"
echo "2. Restart dev server: npm run dev"
echo "3. Check browser console and server logs"
echo "4. If still no images, check S3 Bucket Policy (see FIX_403_FORBIDDEN_S3.md)"

