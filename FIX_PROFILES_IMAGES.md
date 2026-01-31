# Fix Profiles Images Not Loading from S3

## 🔴 Problem

Profiles images exist in S3 (`images/profiles/` folder with 45 JPEG files), but:
- Images show `ERR_NAME_NOT_RESOLVED` errors
- Some images try to load from JavaScript chunks instead of S3 URLs
- Images don't display on the website

## ✅ Root Causes Fixed

### 1. Wrong Default Region ✅ FIXED
- **Issue**: `getImageUrl()` defaulted to `us-east-1` but bucket is in `eu-north-1`
- **Fix**: Changed default region to `eu-north-1` in:
  - `apps/site/lib/image-url.ts` (server-side)
  - `apps/site/lib/image-url-client.ts` (client-side)

### 2. Filename Mismatch ✅ FIXED
- **Issue**: JSON has `F5020-300x200.jpg` but S3 has `F5020.jpg` (no suffix)
- **Fix**: Updated profiles page to remove `-300x200` suffix before generating URLs

## Changes Made

### File 1: `apps/site/lib/image-url.ts`
```typescript
// Changed default region from 'us-east-1' to 'eu-north-1'
const S3_REGION = process.env.AWS_S3_REGION || process.env.NEXT_PUBLIC_AWS_S3_REGION || 'eu-north-1'
```

### File 2: `apps/site/lib/image-url-client.ts`
```typescript
// Changed default region from 'us-east-1' to 'eu-north-1'
const S3_REGION = process.env.NEXT_PUBLIC_AWS_S3_REGION || 'eu-north-1'
```

### File 3: `apps/site/app/[locale]/profiles/page.tsx`
```typescript
// Remove -300x200 suffix to match actual S3 filenames
if (imagePath && imagePath.includes('-300x200')) {
  imagePath = imagePath.replace('-300x200', '')
}
```

## 🧪 Testing

After deploying:

1. **Visit**: `https://pashkovsky-group.com/he/profiles`
2. **Check Browser Console**: Should NOT see `ERR_NAME_NOT_RESOLVED`
3. **Check Network Tab**: Images should load from:
   ```
   https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/profiles/F5020.jpg
   ```
   (NOT `us-east-1` and NOT with `-300x200` suffix)

4. **Verify Images Load**: All profile images should display correctly

## 📋 Additional Requirements

Make sure these are also configured (from previous fixes):

1. ✅ **AWS Credentials in Vercel** (for server-side S3 access)
2. ✅ **S3 Bucket Public Read Access** (for browser image requests)
   - Bucket Policy allows `s3:GetObject`
   - Block Public Access is disabled

## Expected Result

After these fixes:
- ✅ URLs will use correct region: `eu-north-1`
- ✅ URLs will match actual S3 filenames: `F5020.jpg` (not `F5020-300x200.jpg`)
- ✅ Images will load from S3 successfully
- ✅ No more `ERR_NAME_NOT_RESOLVED` errors
