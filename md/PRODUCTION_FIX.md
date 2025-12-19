# ✅ תיקון תמונות בפרודקשן

## 🐛 הבעיה
בפרודקשן (Vercel), התמונות לא נטענו בדפים:
- מעקות (railings)
- מסתורי כביסה (mestor)
- חלונות (windows)
- מהשטח (fromShetah)

**שגיאה:** `Failed to load: https://pashkovsky-gallery.s3...`

---

## 🔍 מה היה הקוד הישן?

הדפים היו Server Components שעשו `fetch` ל-API route:

```typescript
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
const res = await fetch(`${baseUrl}/api/gallery/images?...`)
```

**הבעיה:**
- `VERCEL_URL` לא תמיד זמין בזמן build
- `NEXT_PUBLIC_SITE_URL` לא מוגדר
- Server-to-server fetch לא אמין בפרודקשן

---

## ✅ הפתרון

יצרנו פונקציה שקוראת **ישירות מבסיס הנתונים**:

### קובץ חדש: `lib/gallery/get-gallery-images.ts`

```typescript
import { createClient } from '@supabase/supabase-js'

export async function getGalleryImages(
  categoryKey: string,
  options: { limit?: number; random?: boolean } = {}
): Promise<MediaItem[]> {
  // קריאה ישירה מ-Supabase
  const { data: images } = await supabase
    .from('gallery_images')
    .select('url, filename, storage_path')
    .eq('category_key', categoryKey)
    .limit(limit)
  
  // המרה ל-MediaItem format
  return images.map(img => ({
    src: img.url, // S3 URL מלא
    type: isVideo(img.url) ? 'video' : 'image'
  }))
}
```

---

## 📝 הדפים שעודכנו

### 1️⃣ `/app/[locale]/railings/page.tsx`
```typescript
import { getGalleryImages } from '@/lib/gallery/get-gallery-images'

const dbItems = await getGalleryImages('rails', { limit: 100 })
```

### 2️⃣ `/app/[locale]/mistora/page.tsx`
```typescript
const dbItems = await getGalleryImages('mestor', { limit: 100 })
```

### 3️⃣ `/app/[locale]/windows/page.tsx`
```typescript
const dbItems = await getGalleryImages('windows', { limit: 50, random: true })
```

### 4️⃣ `/app/[locale]/fromShetah/page.tsx`
```typescript
const dbItems = await getGalleryImages('fromShetah', { limit: 100 })
```

---

## 🎯 יתרונות הפתרון

✅ **אמין יותר** - קריאה ישירה מ-DB, ללא תלות ב-API route
✅ **מהיר יותר** - פחות network hops
✅ **עובד בפרודקשן** - לא תלוי ב-`VERCEL_URL` או `NEXT_PUBLIC_SITE_URL`
✅ **Fallback** - אם DB לא זמין, משתמש ב-static JSON

---

## 🚀 Deploy לפרודקשן

### 1️⃣ Build מקומי (בדיקה)
```bash
npm run build
```

### 2️⃣ Push ל-Git
```bash
git add .
git commit -m "fix: use direct DB access for gallery images in production"
git push
```

### 3️⃣ Deploy ל-Vercel
Vercel יבנה אוטומטית.

---

## ✅ בדיקה בפרודקשן

אחרי ה-deploy, בדוק:
- ✅ `https://your-site.com/he/railings`
- ✅ `https://your-site.com/he/mistora`
- ✅ `https://your-site.com/he/windows`
- ✅ `https://your-site.com/he/fromShetah`

כל התמונות אמורות להיטען מ-S3! 🎉

---

## 🔧 Variables נדרשים ב-Vercel

וודא שיש ב-Vercel Environment Variables:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
AWS_S3_BUCKET_NAME=pashkovsky-gallery
AWS_S3_REGION=eu-north-1
NEXT_PUBLIC_AWS_S3_BUCKET_NAME=pashkovsky-gallery
NEXT_PUBLIC_AWS_S3_REGION=eu-north-1
```

---

## 📊 סיכום השינויים

| קובץ | שינוי |
|---|---|
| `lib/gallery/get-gallery-images.ts` | 🆕 קריאה ישירה מ-DB |
| `app/[locale]/railings/page.tsx` | ✏️ משתמש ב-`getGalleryImages` |
| `app/[locale]/mistora/page.tsx` | ✏️ משתמש ב-`getGalleryImages` |
| `app/[locale]/windows/page.tsx` | ✏️ משתמש ב-`getGalleryImages` |
| `app/[locale]/fromShetah/page.tsx` | ✏️ משתמש ב-`getGalleryImages` |

**זה אמור לפתור את הבעיה בפרודקשן!** ✅

