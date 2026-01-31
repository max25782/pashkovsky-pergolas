# Quick Fix: Enable S3 Public Read Access (403 Forbidden)

## 🔴 Current Problem
Images return **403 Forbidden** - S3 bucket blocks public access.

## ✅ Quick Fix (5 minutes)

### Step 1: Open S3 Permissions
1. Go to: https://s3.console.aws.amazon.com/s3/buckets/pashkovsky-gallery/permissions
2. Or: AWS Console → S3 → `pashkovsky-gallery` → **Permissions** tab

### Step 2: Disable Block Public Access ⚠️ CRITICAL

1. Find: **"Block public access (bucket settings)"**
2. Click: **"Edit"**
3. **UNCHECK ALL 4 CHECKBOXES:**
   - ❌ Block all public access
   - ❌ Block public access to buckets and objects granted through new access control lists (ACLs)
   - ❌ Block public access to buckets and objects granted through any access control lists (ACLs)
   - ❌ Block public access to buckets and objects granted through new public bucket or access point policies
   - ❌ Restrict public and cross-account access to buckets and objects through any public bucket or access point policies

4. Click: **"Save changes"**
5. Type: `confirm` in confirmation field
6. Click: **"Confirm"**

**⚠️ IMPORTANT**: If ANY checkbox remains checked, images will still return 403!

### Step 3: Add Bucket Policy

1. On same page, scroll to: **"Bucket policy"**
2. Click: **"Edit"**
3. Paste this policy:

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

4. Click: **"Save changes"**

### Step 4: Test

Open in browser:
```
https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/profiles/F5050.jpg
```

Should show the image (not 403 error).

## ✅ Verification Checklist

- [ ] All 4 "Block Public Access" checkboxes are **unchecked**
- [ ] Bucket Policy is saved with `"Principal": "*"` and `"Action": "s3:GetObject"`
- [ ] Test URL returns image (not 403)
- [ ] Website images load correctly

## 🎯 Expected Result

After these changes:
- ✅ Images load from S3: `https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/profiles/F5050.jpg`
- ✅ No more 403 Forbidden errors
- ✅ All profile images display on website

## 🚨 Still Getting 403?

1. **Double-check**: All 4 Block Public Access checkboxes are unchecked?
2. **Verify**: Bucket Policy is saved correctly?
3. **Wait**: Changes can take 1-2 minutes to propagate
4. **Clear cache**: Hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R)
