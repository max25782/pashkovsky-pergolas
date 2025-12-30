# ✅ עדכון כל עמודי הגלריה ל-S3 ישיר

## מה עודכן:

### 1. ✅ Railings (מעקות)
**קובץ:** `apps/site/app/[locale]/railings/page.tsx`
- מושך תמונות מ-`/api/gallery/rails`
- ישירות מ-S3: `images/rails/`

### 2. ✅ Windows (חלונות)
**קובץ:** `apps/site/app/[locale]/windows/page.tsx`
- מושך תמונות מ-`/api/gallery/windows`
- ישירות מ-S3: `images/windows/`

### 3. ✅ Fences (גדרות/פאנסי)
**קובץ:** `apps/site/components/fences/FencesGallery.tsx`
- מושך תמונות מ-`/api/gallery/fancy`
- ישירות מ-S3: `images/fancy/`

### 4. ✅ Mistora (מסתורי כביסה)
**קובץ:** `apps/site/app/[locale]/mistora/page.tsx`
- מושך תמונות מ-`/api/gallery/mestor`
- ישירות מ-S3: `images/mestor/`

### 5. ✅ From Shetah (מהשטח)
**קובץ:** `apps/site/app/[locale]/fromShetah/page.tsx`
- מושך תמונות מ-`/api/gallery/fromShetah`
- ישירות מ-S3: `images/fromShetah/`

### 6. ✅ Pergulas (פרגולות)
**קובץ:** `apps/site/app/[locale]/pergulas/page.tsx`
- כבר עובד! לא צריך עדכון

---

## API יחיד לכולם:

**`apps/site/app/api/gallery/[category]/route.ts`**

```typescript
// עובד עם כל הקטגוריות:
GET /api/gallery/rails      → images/rails/ in S3
GET /api/gallery/windows    → images/windows/ in S3
GET /api/gallery/fancy      → images/fancy/ in S3
GET /api/gallery/mestor     → images/mestor/ in S3
GET /api/gallery/fromShetah → images/fromShetah/ in S3
GET /api/gallery/pergulot   → images/pergulot/ in S3
GET /api/gallery/dgamim     → images/dgamim/ in S3
```

---

## מבנה S3:

```
pashkovsky-gallery/
├── images/
│   ├── rails/           ✅ מעקות
│   ├── windows/         ✅ חלונות
│   ├── fancy/           ✅ גדרות
│   ├── mestor/          ✅ מסתורי כביסה
│   ├── fromShetah/      ✅ מהשטח
│   ├── pergulot/        ✅ פרגולות
│   └── dgamim/          ✅ דגמים
```

---

## איך זה עובד:

1. **משתמש פותח עמוד** (למשל `/he/railings`)
2. **העמוד קורא ל-API** → `fetch('/api/gallery/rails')`
3. **API סורק את S3** → `images/rails/` → מחזיר רשימת קבצים
4. **MediaGallery מציג** → תמונות + וידאו עם lightbox

---

## יתרונות:

✅ **פשוט** - העלית תמונה ל-S3 → מיד רואים באתר  
✅ **מהיר** - לא צריך Supabase, רק S3  
✅ **זול** - פחות read units  
✅ **תמיד מעודכן** - סינכרון אוטומטי  

---

## בדיקה:

```bash
# בדוק API
curl http://localhost:3000/api/gallery/rails
curl http://localhost:3000/api/gallery/windows
curl http://localhost:3000/api/gallery/fancy

# פתח דפדפן
http://localhost:3000/he/railings
http://localhost:3000/he/windows
http://localhost:3000/he/fences
http://localhost:3000/he/mistora
http://localhost:3000/he/fromShetah
```

---

## הערות:

- **Kesh:** כל תמונה נשארת בזיכרון זמני למשך שעה (`revalidate: 3600`)
- **Fallback:** אם S3 לא עובד, העמוד יציג מערך ריק (לא יקרוס)
- **Supabase:** כבר לא צריך `gallery_images` או `gallery_categories`

---

## קבצים שלא צריכים יותר:

```
apps/site/lib/gallery/get-gallery-images.ts  ❌ לא בשימוש
apps/site/data/gallery/rails.json            ❌ לא בשימוש
apps/site/data/gallery/windows.json          ❌ לא בשימוש
apps/site/data/gallery/mestor.json           ❌ לא בשימוש
apps/site/data/gallery/fromShetah.json       ❌ לא בשימוש
apps/site/data/gallery/fancy.json            ❌ לא בשימוש (אבל נשאר fallback ב-FencesGallery)
```

אפשר למחוק אותם או להשאיר כ-fallback.

---

## ✨ סיכום:

כל עמודי הגלריה עובדים עכשיו ישירות מ-S3!  
העלה תמונה → רענן דף → תראה אותה מיד.

