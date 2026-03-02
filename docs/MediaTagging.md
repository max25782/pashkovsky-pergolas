# Media Tagging System for AI Chat

Tags are stored in **Supabase** (`media_assets` table), not in S3 object metadata.
S3 objects are accessed via **presigned URLs** (15-minute expiry). No public S3 URLs needed for AI images.

---

## Architecture

```
AI Chat ──► fetchImagesByContext(text)
              │
              ▼
        POST /api/media/query
              │
              ▼
        Supabase: media_assets
        WHERE company_id = ?
          AND tags @> ['פרגולה קלאסית']
              │
              ▼
        presignGetObject(key, 900s)  ← server-side only
              │
              ▼
        Returns presigned URLs to frontend
```

---

## Available Tags (Hebrew)

| Tag | Description |
|-----|-------------|
| `פרגולה קלאסית` | Classic aluminum pergola |
| `פרגולה היי-טק` | High-tech motorized pergola |
| `פרגולה למטבח חוץ` | Outdoor kitchen pergola |
| `פרגולה ביוקלמטיק` | Bioclimatic pergola |
| `פרגולה pvc` | PVC pergola |
| `פרגולה תלויה` | Hanging/suspended pergola |
| `פרגולה דמוי עץ` | Wood-look pergola |
| `פרגולה יוקרה עם כיסוי זכוכית` | Luxury glass-covered pergola |

To add more tags: update `VALID_TAGS` in `/api/media/tag/route.ts` and `MEDIA_TAGS` in `components/admin/media/TagSelector.tsx`.

---

## Admin Workflow

1. Navigate to **CRM → Admin → מדיה AI** (`/app/admin/media`)
2. Enter S3 prefix (e.g. `images/pergulot/ashdod/`) and click **חפש**
3. Click **ייבא מ-S3** — this creates empty `media_assets` rows for all discovered S3 keys
4. Click **הוסף תגיות** on individual images, or select multiple → bulk apply
5. Once tagged, the AI chat will return these images when users ask about relevant pergola types

---

## S3 Bucket Configuration

### Make bucket PRIVATE

1. In AWS Console → S3 → `pashkovsky-gallery` → Permissions
2. **Block Public Access**: enable all four settings
3. **Bucket Policy**: remove any `"Principal": "*"` allow statements
4. Existing public URLs (`gallery_images` table) will break — see migration note below

### CORS (for presigned URL delivery to site/crm)

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET"],
    "AllowedOrigins": [
      "https://pashkovsky-group.com",
      "https://crm.pashkovsky-group.com",
      "http://localhost:3000",
      "http://localhost:3001"
    ],
    "ExposeHeaders": [],
    "MaxAgeSeconds": 3000
  }
]
```

### IAM Policy (server role / Vercel env credentials)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::pashkovsky-gallery",
      "Condition": {
        "StringLike": {
          "s3:prefix": ["images/*"]
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::pashkovsky-gallery/*"
    }
  ]
}
```

---

## Migration: Existing `gallery_images` Public URLs

If you make the bucket private, existing `gallery_images` URLs will break.

**Option A (recommended for now):** Keep bucket public for existing gallery. Only `media_assets` uses presigned URLs. The AI chat switches to presigned; the site gallery continues using public URLs.

**Option B (full migration):** Update `admin-api/gallery/images/route.ts` and `api/gallery/images/route.ts` to call `presignGetObject()` before returning image URLs. Update `apps/site/app/api/gallery/[category]/route.ts` similarly.

---

## DB Migration

Run `apps/crm/supabase/migrations/create_media_assets.sql` in Supabase SQL Editor.

```sql
-- Quick check after migration:
SELECT COUNT(*) FROM media_assets;
SELECT * FROM media_assets WHERE tags @> ARRAY['פרגולה קלאסית'] LIMIT 3;
```

---

## TODO (Multi-tenant v2)

- [ ] Add per-company S3 prefix: `images/{company_id}/...`
- [ ] Update `listS3Objects` prefix validation to enforce company prefix
- [ ] Remove `DEFAULT_COMPANY_ID` fallback from `/api/media/query`
- [ ] Add `s3_key` starts-with-company-prefix check to RLS policy
