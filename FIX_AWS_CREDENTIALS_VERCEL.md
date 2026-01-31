# Fix AWS Credentials in Vercel - Production Media Gallery Issue

## 🔴 Problem Identified

Vercel logs show:
```
[Railings] Error fetching from S3: The AWS Access Key Id you provided does not exist in our records.
```

**Root Cause**: AWS credentials are missing or incorrect in Vercel production environment variables.

## ✅ Solution: Add AWS Credentials to Vercel

### Step 1: Open Vercel Dashboard
1. Go to https://vercel.com/dashboard
2. Select your project: **pashkovsky-pergolas** (or **pashkovsky-site**)
3. Navigate to: **Settings** → **Environment Variables**

### Step 2: Add Required AWS Variables

Add these **5 environment variables** for **Production** environment:

```bash
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AWS_S3_BUCKET_NAME=pashkovsky-gallery
AWS_S3_REGION=eu-north-1
NEXT_PUBLIC_AWS_S3_BUCKET_NAME=pashkovsky-gallery
NEXT_PUBLIC_AWS_S3_REGION=eu-north-1
```

### Step 3: Set Environment Scope

For each variable:
1. **Environment**: Select **Production** (and optionally **Preview**)
2. Click **Save**

**Important**: Make sure to select **Production** environment, not just Preview/Development!

### Step 4: Redeploy

After adding variables:
1. Go to **Deployments** tab
2. Click **Redeploy** on the latest deployment (or push a new commit)
3. Wait for deployment to complete

## 🔍 Verify AWS Credentials Are Valid

If you're still getting errors after adding credentials, verify:

1. **Check AWS IAM Console**:
   - Go to https://console.aws.amazon.com/iam/
   - Find the user with your Access Key ID
   - Verify the key is **Active** (not deleted/disabled)

2. **Check IAM Permissions**:
   The IAM user needs these permissions:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:ListBucket",
           "s3:GetObject"
         ],
         "Resource": [
           "arn:aws:s3:::pashkovsky-gallery",
           "arn:aws:s3:::pashkovsky-gallery/*"
         ]
       }
     ]
   }
   ```

3. **Verify Bucket Name**:
   - Confirm the bucket `pashkovsky-gallery` exists
   - Check it's in region `eu-north-1`
   - Verify files exist at paths:
     - `images/rails/`
     - `images/fromShetah/`
     - `images/windows/`
     - etc.

## 🧪 Test After Fix

1. Visit: `https://pashkovsky-group.com/he/railings`
2. Open browser DevTools → Console
3. Check for `[Railings]` logs - should show:
   ```
   [Railings] Fetching from S3: bucket=pashkovsky-gallery, region=eu-north-1, prefix=images/rails/
   [Railings] S3 response: X total objects, isTruncated=false
   [Railings] Processed X media items (Y videos, Z images)
   ```

4. Check Vercel logs again - should no longer show AWS errors

## 📋 Quick Checklist

- [ ] Added `AWS_ACCESS_KEY_ID` to Vercel Production
- [ ] Added `AWS_SECRET_ACCESS_KEY` to Vercel Production
- [ ] Added `AWS_S3_BUCKET_NAME` to Vercel Production
- [ ] Added `AWS_S3_REGION` to Vercel Production
- [ ] Added `NEXT_PUBLIC_AWS_S3_BUCKET_NAME` to Vercel Production
- [ ] Added `NEXT_PUBLIC_AWS_S3_REGION` to Vercel Production
- [ ] Selected **Production** environment for all variables
- [ ] Redeployed the application
- [ ] Verified media loads on production site

## 🚨 If Still Not Working

If you still see errors after adding credentials:

1. **Check for typos** in variable names (case-sensitive!)
2. **Verify AWS credentials** are still valid (not rotated/deleted)
3. **Check Vercel logs** for new error messages
4. **Verify bucket name** matches exactly: `pashkovsky-gallery`
5. **Check region** matches: `eu-north-1`

## 📝 Note on Security

⚠️ **Important**: The credentials shown in `.env.local` are now exposed. After fixing production:
- Consider rotating AWS credentials
- Update `.env.local` with new credentials
- Update Vercel with new credentials
