# Fix Site Gallery Images - Copy AWS Keys

## Problem
Your S3 bucket has **LOTS of images** (rails, windows, mestor), but the Site app can't load them because `apps/site/.env.local` has **invalid AWS credentials**.

From terminal logs:
```
[Railings] Error fetching from S3: The AWS Access Key Id you provided does not exist in our records.
```

But S3 is working fine (you verified with `aws s3 ls`):
- ✅ `images/rails/` - 92+ files
- ✅ `images/windows/` - 24+ files
- ✅ `images/mestor/` - 34+ files

---

## Solution

Copy the **correct AWS credentials** from CRM to Site.

### Step 1: Open Terminal

```bash
cd ~/Downloads/pashkovsky-pergolas_starter
```

### Step 2: Check CRM credentials (these are correct for PDF uploads)

```bash
cat apps/crm/.env.local | grep -E "^AWS_"
```

You should see something like:
```
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_REGION=eu-north-1
AWS_S3_BUCKET_NAME=pashkovsky-gallery
```

### Step 3: Open Site .env.local in TextEdit or VS Code

```bash
open -a TextEdit apps/site/.env.local
```

Or in VS Code:
```bash
code apps/site/.env.local
```

### Step 4: Add/Replace these lines in `apps/site/.env.local`

Copy the values from `apps/crm/.env.local` and paste them:

```env
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=AKIA... (copy from apps/crm/.env.local)
AWS_SECRET_ACCESS_KEY=... (copy from apps/crm/.env.local)
AWS_S3_REGION=eu-north-1

# Gallery bucket (public images)
NEXT_PUBLIC_AWS_S3_BUCKET_NAME=pashkovsky-gallery
NEXT_PUBLIC_AWS_S3_REGION=eu-north-1
```

**Important:** Make sure `AWS_ACCESS_KEY_ID` starts with `AKIA` (not `AAKIA`)!

### Step 5: Save and Restart Server

1. Save `apps/site/.env.local` (Cmd+S)
2. In the terminal running `npm run dev`, press **Ctrl+C** to stop
3. Run again:
   ```bash
   npm run dev
   ```

### Step 6: Test

Open in browser:
- http://localhost:3000/he/railings
- http://localhost:3000/he/windows  
- http://localhost:3000/he/mistora

You should see **TONS of images** loading from S3! 🚀

---

## Expected Result

Terminal should show:
```
[Railings] Loaded from S3: 92
[MediaGallery] Received items: 92
[MediaGallery] Videos: 0 Images: 92
```

(Numbers might vary, but should be > 0)

---

## If Still Getting 0 Items

Run this to verify S3 access from Node.js:

```bash
cd apps/site
node -e "
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
require('dotenv').config({ path: '.env.local' });

const s3 = new S3Client({
  region: process.env.AWS_S3_REGION || 'eu-north-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

(async () => {
  try {
    const result = await s3.send(new ListObjectsV2Command({
      Bucket: 'pashkovsky-gallery',
      Prefix: 'images/rails/',
      MaxKeys: 5,
    }));
    console.log('✅ S3 access works!');
    console.log('Sample files:', result.Contents?.map(f => f.Key));
  } catch (err) {
    console.error('❌ S3 error:', err.message);
  }
})();
"
```

This will test if Node.js can access S3 with your credentials.
