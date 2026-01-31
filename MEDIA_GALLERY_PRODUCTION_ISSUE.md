# Media Gallery Production Issue - Root Cause Analysis

## Problem
Media galleries show **0 items** in production (`pashkovsky-group.com/he/railings`) but work correctly in development (`localhost:3000`).

## Root Cause - CONFIRMED ✅

**Vercel logs show the exact error:**
```
[Railings] Error fetching from S3: The AWS Access Key Id you provided does not exist in our records.
```

The issue is **missing or invalid AWS credentials in Vercel production environment**:

1. **Production Environment**: AWS S3 credentials are **NOT configured** in Vercel (or are incorrect)
2. **S3 Fetch Attempt**: Code tries to fetch media from S3 bucket
3. **AWS Authentication Fails**: AWS rejects the request because the Access Key ID doesn't exist
4. **Error Caught**: Code catches the error and falls back to static JSON files
5. **Fallback Fails**: Static JSON files (`rails.json`, `fromShetah.json`) are **empty** (`{"items": []}`)
6. **Result**: 0 items displayed

**Solution**: Add AWS credentials to Vercel Production environment variables. See `FIX_AWS_CREDENTIALS_VERCEL.md` for step-by-step instructions.

## Why It Works in Development

In development, either:
- S3 credentials are not set → falls back to static data (but static data is empty, so this shouldn't work either)
- OR S3 credentials are set and working correctly → fetches from S3 successfully

**Note**: The dev console shows `Videos: 11 Images: 13` for `/he/railings`, which means S3 is working in dev.

## Files Affected

- `apps/site/app/[locale]/railings/page.tsx` - Railings gallery
- `apps/site/app/[locale]/fromShetah/page.tsx` - From Shetah gallery
- `apps/site/app/[locale]/windows/page.tsx` - Windows gallery
- `apps/site/app/[locale]/mistora/page.tsx` - Mistora gallery

## Changes Made

### Enhanced Logging
Added comprehensive logging to diagnose the issue:

1. **Configuration Logging**: Logs bucket name, region, prefix before S3 call
2. **S3 Response Logging**: Logs total objects returned, truncation status, sample keys
3. **Processing Logging**: Logs how many items were processed (videos vs images)
4. **Error Logging**: Enhanced error details including AWS error codes and HTTP status
5. **Fallback Logging**: Logs when falling back to static data and how many items it contains

### Updated Files
- ✅ `apps/site/app/[locale]/railings/page.tsx` - Enhanced logging added
- ✅ `apps/site/app/[locale]/fromShetah/page.tsx` - Enhanced logging added

## Next Steps to Fix

### 1. Check Production Logs
After deploying the enhanced logging, check Vercel function logs to see:
- What bucket name is being used
- What prefix is being queried
- How many objects S3 returns
- Any error messages

### 2. Verify S3 Configuration in Production
Check Vercel environment variables:
- `NEXT_PUBLIC_AWS_S3_BUCKET_NAME` - Should match the bucket with media files
- `AWS_S3_REGION` or `NEXT_PUBLIC_AWS_S3_REGION` - Should be correct region
- `AWS_ACCESS_KEY_ID` - Should have `s3:ListBucket` permission
- `AWS_SECRET_ACCESS_KEY` - Should be valid

### 3. Verify S3 Bucket Contents
Check if the S3 bucket actually contains files:
- Path: `images/rails/` for railings gallery
- Path: `images/fromShetah/` for fromShetah gallery
- Verify files exist and are accessible

### 4. Check IAM Permissions
Ensure the AWS credentials have:
- `s3:ListBucket` on the bucket
- `s3:GetObject` on objects (if needed)

### 5. Alternative Solutions

**Option A: Use Database-Backed Approach**
Instead of direct S3 calls, use `getGalleryImages()` from `@/lib/gallery/get-gallery-images.ts` which fetches from Supabase database. This is more reliable but requires database to be populated.

**Option B: Populate Static JSON Files**
If S3 is unreliable, populate the static JSON files (`rails.json`, `fromShetah.json`) with actual media URLs as a fallback.

**Option C: Use API Routes**
Switch to using `/api/gallery/[category]` routes which have better error handling and can be cached.

## How to Test

1. Deploy the changes with enhanced logging
2. Visit production site: `pashkovsky-group.com/he/railings`
3. Check Vercel function logs (Runtime Logs in Vercel dashboard)
4. Look for `[Railings]` prefixed logs to see what's happening
5. Compare with development logs to identify differences

## Expected Log Output

After fix, you should see logs like:
```
[Railings] Fetching from S3: bucket=your-bucket-name, region=eu-north-1, prefix=images/rails/
[Railings] S3 response: 24 total objects, isTruncated=false
[Railings] Sample keys: ['images/rails/image1.jpg', 'images/rails/image2.jpg', ...]
[Railings] Processed 24 media items (11 videos, 13 images)
```

If S3 fails:
```
[Railings] Error fetching from S3: { message: '...', code: 'AccessDenied', ... }
[Railings] Error fallback: static data contains 0 items
```
