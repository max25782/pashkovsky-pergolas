# 🔧 Why Images Are Not Loading

## From your screenshots, I see:
```
[MediaGallery] Received items: 0
[MediaGallery] Videos: 0 Images: 0
```

This means the code is working, but S3 is returning 0 items.

---

## Most Common Reasons:

### 1. ❌ AWS Credentials Missing in `apps/site/.env.local`

**Check if this file exists and has all 4 variables:**

```bash
cat apps/site/.env.local
```

**Should contain:**
```env
NEXT_PUBLIC_AWS_S3_BUCKET_NAME=pashkovsky-gallery
NEXT_PUBLIC_AWS_S3_REGION=eu-north-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

**If missing, create it:**
```bash
nano apps/site/.env.local
```

Then paste the 4 variables above with your real credentials.

---

### 2. ❌ S3 Folders Are Empty

The folders exist in S3 (we saw them in AWS Console), but they might be empty.

**Check if there are files inside:**
```bash
aws s3 ls s3://pashkovsky-gallery/images/mestor/ --recursive
aws s3 ls s3://pashkovsky-gallery/images/rails/ --recursive
aws s3 ls s3://pashkovsky-gallery/images/windows/ --recursive
```

**If empty**, you need to upload files:
```bash
# Upload from local public folder to S3
aws s3 sync public/images/mestor/ s3://pashkovsky-gallery/images/mestor/
aws s3 sync public/images/rails/ s3://pashkovsky-gallery/images/rails/
aws s3 sync public/images/windows/ s3://pashkovsky-gallery/images/windows/
```

---

### 3. ❌ Server Not Restarted After Adding Credentials

Environment variables are only loaded when the server starts.

**Restart the dev server:**
```bash
# Stop current server (Ctrl+C)
npm run dev
```

---

### 4. ❌ Wrong .env.local Location

The file must be in `apps/site/.env.local`, NOT in the root folder.

**Correct location:**
```
pashkovsky-pergolas_starter/
└── apps/
    └── site/
        └── .env.local  ← HERE
```

**NOT here:**
```
pashkovsky-pergolas_starter/
└── .env.local  ← WRONG LOCATION
```

---

### 5. ❌ Bucket Policy Not Applied (403 Forbidden)

Even if files exist, browser can't load them without public read access.

**Apply Bucket Policy in AWS Console:**

1. Go to: https://s3.console.aws.amazon.com/s3/buckets/pashkovsky-gallery/permissions
2. Disable "Block Public Access" (all 4 checkboxes OFF)
3. Add Bucket Policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::pashkovsky-gallery/*"
    }
  ]
}
```

---

## Quick Diagnostic Steps

### Step 1: Check .env.local exists
```bash
ls -la apps/site/.env.local
```

Expected: File exists

### Step 2: Check AWS credentials
```bash
cd apps/site && cat .env.local | grep AWS
```

Expected:
```
NEXT_PUBLIC_AWS_S3_BUCKET_NAME=pashkovsky-gallery
NEXT_PUBLIC_AWS_S3_REGION=eu-north-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

### Step 3: Check server logs
When you open `/railings`, check terminal output:

**Expected (working):**
```
[Railings] Listing S3 objects with prefix: images/rails/
[Railings] S3 Response: { totalObjects: 15, ... }
[Railings] Returning 15 items from S3
```

**If you see (not working):**
```
[Railings] S3 not configured, using static data
```
→ Means AWS credentials are missing

### Step 4: Check browser console
Press F12 → Console tab

**Expected (working):**
```
[MediaGallery] Received items: 15
[MediaGallery] Videos: 0 Images: 15
```

**If you see:**
```
[MediaGallery] Received items: 0
```
→ Means S3 folders are empty or credentials wrong

---

## Most Likely Solution

Based on your screenshots showing "Received items: 0" for all pages, the issue is probably:

1. **AWS credentials not in `apps/site/.env.local`**, OR
2. **S3 folders are empty** (no files uploaded yet)

---

## Action Plan

1. **Create/check `apps/site/.env.local`:**
   ```bash
   nano apps/site/.env.local
   ```
   
   Add these 4 lines with your real credentials:
   ```env
   NEXT_PUBLIC_AWS_S3_BUCKET_NAME=pashkovsky-gallery
   NEXT_PUBLIC_AWS_S3_REGION=eu-north-1
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=...
   ```

2. **Restart server:**
   ```bash
   npm run dev
   ```

3. **Check if S3 has files:**
   ```bash
   aws s3 ls s3://pashkovsky-gallery/images/ --recursive | head -20
   ```

4. **If empty, upload files:**
   ```bash
   aws s3 sync public/images/ s3://pashkovsky-gallery/images/
   ```

5. **Apply Bucket Policy** (see step 5 above)

6. **Open browser** → Check `/railings`, `/windows`, etc.

---

## Need Help?

Run this diagnostic script:
```bash
./scripts/check-s3-config.sh
```

It will tell you exactly what's missing.

