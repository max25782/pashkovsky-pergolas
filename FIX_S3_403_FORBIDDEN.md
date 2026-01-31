# Fix S3 403 Forbidden - Images Not Loading

## 🔴 Problem

Images return **403 Forbidden** when accessed directly:
```
https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/profiles/F5020-300x200.jpg
Status: 403 Forbidden
```

**Root Cause**: S3 bucket `pashkovsky-gallery` doesn't allow public read access.

## ✅ Solution: Enable Public Read Access

### Step 1: Open S3 Console

1. Go to: https://s3.console.aws.amazon.com/s3/buckets/pashkovsky-gallery/permissions
2. Or navigate: AWS Console → S3 → `pashkovsky-gallery` → **Permissions** tab

### Step 2: Disable Block Public Access (CRITICAL!)

1. Find section: **"Block public access (bucket settings)"**
2. Click **"Edit"**
3. **UNCHECK ALL 4 CHECKBOXES:**
   - ❌ Block all public access
   - ❌ Block public access to buckets and objects granted through new access control lists (ACLs)
   - ❌ Block public access to buckets and objects granted through any access control lists (ACLs)
   - ❌ Block public access to buckets and objects granted through new public bucket or access point policies
   - ❌ Restrict public and cross-account access to buckets and objects through any public bucket or access point policies

4. Click **"Save changes"**
5. Type `confirm` in the confirmation field
6. Click **"Confirm"**

**⚠️ IMPORTANT**: If ANY checkbox is checked, public access will be blocked even with a Bucket Policy!

### Step 3: Add Bucket Policy

1. On the same **Permissions** page, scroll to **"Bucket policy"**
2. Click **"Edit"**
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

4. Click **"Save changes"**

### Step 4: Verify Object Ownership

1. On the **Permissions** page, check **"Object Ownership"**
2. Should be: **"Bucket owner enforced"** (this is fine - we're using Bucket Policy, not ACLs)

## 🧪 Test the Fix

### Test 1: Direct URL Access

Open in browser:
```
https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/profiles/F5020-300x200.jpg
```

Should show the image (not 403 error).

### Test 2: Check Production Site

1. Visit: `https://pashkovsky-group.com/he/profiles`
2. Images should load (not black boxes)
3. Check browser DevTools → Network tab
4. Image requests should return `200 OK` instead of `403 Forbidden`

### Test 3: Using curl

```bash
curl -I https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/profiles/F5020-300x200.jpg
```

Should return:
```
HTTP/1.1 200 OK
Content-Type: image/jpeg
```

## 🔍 Troubleshooting

### Still Getting 403?

1. **Verify Block Public Access is OFF**:
   - Go to Permissions → Block Public Access
   - All 4 checkboxes must be **unchecked**

2. **Verify Bucket Policy is Applied**:
   - Go to Permissions → Bucket Policy
   - Should see the policy with `"Principal": "*"` and `"Action": "s3:GetObject"`

3. **Check IAM Permissions**:
   - Your AWS user needs `s3:PutBucketPolicy` permission
   - If you don't have this, ask your AWS admin

4. **Verify Bucket Name**:
   - Make sure it's exactly: `pashkovsky-gallery`
   - Check region: `eu-north-1`

### Using AWS CLI (Alternative)

If you prefer CLI:

```bash
# 1. Disable Block Public Access
aws s3api put-public-access-block \
  --bucket pashkovsky-gallery \
  --public-access-block-configuration \
  "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

# 2. Apply Bucket Policy
cat > /tmp/bucket-policy.json << 'EOF'
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
EOF

aws s3api put-bucket-policy \
  --bucket pashkovsky-gallery \
  --policy file:///tmp/bucket-policy.json
```

## 📋 Quick Checklist

- [ ] Opened S3 bucket permissions page
- [ ] Unchecked ALL 4 "Block Public Access" checkboxes
- [ ] Saved Block Public Access changes
- [ ] Added Bucket Policy with public read access
- [ ] Saved Bucket Policy
- [ ] Tested direct URL access (should return 200 OK)
- [ ] Verified images load on production site

## 🔒 Security Note

**Making the bucket public means:**
- ✅ Anyone with the URL can view images (this is intentional for a public website)
- ✅ Images are still protected by obscurity (hard to guess URLs)
- ⚠️ Consider using CloudFront with signed URLs if you need more control

For a public marketing website, public read access is typically fine.

## 🎯 Summary

The issue is that your S3 bucket blocks public access. To fix:
1. **Disable** all Block Public Access settings
2. **Add** a Bucket Policy allowing public `s3:GetObject`
3. **Test** that images load

After these changes, your images should load correctly in production! 🎉
