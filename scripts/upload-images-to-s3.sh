#!/bin/bash

echo "=== Uploading Images to S3 ==="
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
  echo "❌ AWS CLI is not installed"
  echo ""
  echo "Install it first:"
  echo "  brew install awscli"
  echo "  or visit: https://aws.amazon.com/cli/"
  exit 1
fi

echo "✅ AWS CLI is installed"
echo ""

# Check if public/images exists
if [ ! -d "apps/site/public/images" ]; then
  echo "❌ apps/site/public/images directory not found"
  echo ""
  echo "No local images to upload."
  exit 1
fi

echo "📁 Found local images directory"
echo ""

# Upload all categories to S3
BUCKET="pashkovsky-gallery"

echo "Uploading images to S3 bucket: $BUCKET"
echo ""

# Upload each category
for category in rails windows mestor fromShetah fancy pergulot profiles; do
  if [ -d "apps/site/public/images/$category" ]; then
    echo "📤 Uploading $category..."
    aws s3 sync "apps/site/public/images/$category/" "s3://$BUCKET/images/$category/" \
      --exclude "*.DS_Store" \
      --exclude ".gitkeep" \
      --acl public-read
    
    if [ $? -eq 0 ]; then
      echo "✅ $category uploaded successfully"
    else
      echo "❌ Failed to upload $category"
    fi
    echo ""
  else
    echo "⚠️  Skipping $category (directory not found)"
  fi
done

echo ""
echo "=== Upload Complete ==="
echo ""
echo "Verify uploads:"
echo "  aws s3 ls s3://$BUCKET/images/ --recursive | head -20"
echo ""
echo "Then restart server: npm run dev"

