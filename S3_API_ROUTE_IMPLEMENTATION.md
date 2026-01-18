# ✅ S3 Gallery API Route Implementation

## Changes Made

### 1. Created API Route: `apps/site/app/api/gallery/from-shetah/route.ts`

**Features:**
- ✅ Uses `runtime = 'nodejs'` for server-only execution
- ✅ Uses `@aws-sdk/client-s3` (S3Client + ListObjectsV2Command)
- ✅ Reads **server-only** env vars (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET_NAME, AWS_S3_REGION)
- ✅ Lists all files from `images/fromShetah/` prefix
- ✅ Filters extensions: webp, jpg, jpeg, png, gif, mp4, webm, mov
- ✅ Maps to `{ src, type }` format
- ✅ Sorts by key ascending
- ✅ Returns `{ items: [] }` on error (graceful fallback)
- ✅ Detailed logging: `[from-shetah API] returned X items`

**Endpoint:** `GET /api/gallery/from-shetah`

**Response:**
```json
{
  "items": [
    { "src": "https://bucket.s3.region.amazonaws.com/images/fromShetah/1.webp", "type": "image" },
    { "src": "https://bucket.s3.region.amazonaws.com/images/fromShetah/video.mp4", "type": "video" }
  ]
}
```

---

### 2. Updated Page: `apps/site/app/[locale]/fromShetah/page.tsx`

**Changes:**
- ❌ Removed AWS SDK imports and `getS3Client()` entirely
- ✅ Refactored `getFromShetahImages()` to:
  - Fetch from `/api/gallery/from-shetah` (server-side fetch)
  - Use `cache: 'no-store'` for fresh data
  - Fallback to `fromShetah.json` if API fails or returns empty
- ✅ Added log: `[FromShetah Page] items: X`

---

### 3. Updated `next.config.js`

**Added wildcard S3 pattern:**
```js
{
  protocol: 'https',
  hostname: '*.s3.*.amazonaws.com',
  pathname: '/**',
}
```

This allows Next.js `<Image>` component to load images from **any S3 bucket** (pashkovsky-gallery, etc.)

---

## Test Steps

### Step 1: Verify API Route Works

Open in browser or curl:
```bash
curl http://localhost:3000/api/gallery/from-shetah
```

**Expected Response:**
```json
{
  "items": [
    { "src": "https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/fromShetah/...", "type": "image" }
  ]
}
```

Check terminal for logs:
```
[from-shetah API] Listing S3 objects: bucket=pashkovsky-gallery, prefix=images/fromShetah/
[from-shetah API] S3 returned 50 objects
[from-shetah API] Returning 50 items
```

---

### Step 2: Verify Page Loads Images

1. Open: http://localhost:3000/he/fromShetah
2. Check browser console:
   ```
   [FromShetah Page] Loaded from API: 50 items
   [MediaGallery] Received items: 50
   [MediaGallery] Videos: 5 Images: 45
   ```

3. Verify images display in the gallery

---

### Step 3: Test Fallback (if API fails)

1. Temporarily rename `.env.local` to test fallback:
   ```bash
   mv apps/site/.env.local apps/site/.env.local.backup
   ```

2. Restart server:
   ```bash
   npm run dev
   ```

3. Open page - should show static fallback data from `fromShetah.json`

4. Restore `.env.local`:
   ```bash
   mv apps/site/.env.local.backup apps/site/.env.local
   ```

---

## Vercel Deployment

### Required Environment Variables (Vercel Dashboard)

Go to: Vercel Dashboard → Project Settings → Environment Variables

Add **server-side only** (NOT `NEXT_PUBLIC_*`):

```
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_REGION=eu-north-1
AWS_S3_BUCKET_NAME=pashkovsky-gallery
```

⚠️ **Important:** These are server-only secrets. Do NOT use `NEXT_PUBLIC_*` prefix for AWS credentials.

---

## Benefits

✅ **No DB** - Direct S3 public URLs  
✅ **Server-only AWS credentials** - Never exposed to client  
✅ **Graceful fallback** - Uses static JSON if S3 fails  
✅ **Works on Vercel** - No edge runtime issues  
✅ **Cached properly** - `cache: 'no-store'` for fresh data  
✅ **Detailed logging** - Easy to debug  

---

## Next Steps

Apply the same pattern to other galleries:
- `apps/site/app/api/gallery/rails/route.ts` (prefix: `images/rails/`)
- `apps/site/app/api/gallery/windows/route.ts` (prefix: `images/windows/`)
- `apps/site/app/api/gallery/mestor/route.ts` (prefix: `images/mestor/`)

Just copy `from-shetah/route.ts` and change the `prefix` value! 🚀

