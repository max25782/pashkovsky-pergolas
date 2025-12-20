# 📸 How to Upload Images to S3

## ✅ System Status

Your upload system is **working correctly**:
- ✅ S3 configured: `pashkovsky-gallery` (eu-north-1)
- ✅ AWS credentials: Valid
- ✅ Database: Connected
- ✅ Recent uploads: 800 files in last 24 hours

---

## 📋 Upload Process

### 1️⃣ **Access Admin Gallery Page**
```
http://localhost:3000/he/admin/gallery
```

### 2️⃣ **Select Category**
Choose from:
- `pergulas` - פרגולות
- `rails` - מעקות
- `mestor` - מסתורי כביסה
- `windows` - חלונות
- `fromShetah` - מהשטח
- `fancy` - גדרות
- `dgamim` - דגמים

### 3️⃣ **Select Files**
- Max 10MB per file
- Formats: JPG, PNG, WebP, GIF
- Multiple files supported

### 4️⃣ **Click "העלה ל-S3"**
The system will:
1. ✅ Optimize images (convert to WebP, resize to max 1920px)
2. ✅ Upload to S3: `images/{category}/{filename}.webp`
3. ✅ Save metadata to database (`gallery_images` table)
4. ✅ Return public URL

---

## 🔍 Verify Upload

### Check S3
```bash
node scripts/check-recent-uploads.mjs
```

### Check Database
```sql
SELECT * FROM gallery_images 
ORDER BY created_at DESC 
LIMIT 10;
```

### Check Website
After upload, images should appear on:
- `/he/railings` - מעקות
- `/he/mistora` - מסתורי כביסה
- `/he/windows` - חלונות
- `/he/fromShetah` - מהשטח
- `/he/fences` - גדרות
- `/he/models` - דגמים

---

## 🐛 Troubleshooting

### "Upload failed"
1. Check browser console (F12) for errors
2. Verify admin token is correct
3. Check file size (max 10MB)
4. Check file format (jpg/png/webp/gif)

### "Images not appearing on website"
1. **Local dev:** Restart dev server (`npm run dev`)
2. **Production:** Deploy changes:
   ```bash
   git add .
   git commit -m "update gallery"
   git push
   ```

### "S3 upload succeeded but not in database"
Check server logs for database errors:
```bash
# In production (Vercel)
vercel logs
```

### "Database insert succeeded but not in S3"
Check AWS credentials:
```bash
node scripts/test-s3-upload.mjs
```

---

## 📊 Current Stats

Last checked: **19.12.2025, 18:35**

| Location | Count |
|---|---|
| S3 files (images/) | 830 |
| Database records | 755+ |
| Recent uploads (24h) | 800 |

### Recent Categories:
- `fancy` (גדרות): 6 files
- `dgamim` (דגמים): 4 files
- `windows` (חלונות): 47 videos + images

---

## 🎯 Quick Test

Upload a test image:
1. Go to `/he/admin/gallery`
2. Select category: `rails`
3. Choose 1 image file
4. Click "העלה ל-S3"
5. Wait for success message
6. Check `/he/railings` page

---

## 🔗 Useful Links

- **S3 Bucket:** https://s3.console.aws.amazon.com/s3/buckets/pashkovsky-gallery
- **Supabase:** https://supabase.com/dashboard/project/your-project
- **Admin Gallery:** http://localhost:3000/he/admin/gallery

---

## 💡 Notes

- Images are automatically optimized to WebP format
- Max resolution: 1920x1920 (preserves aspect ratio)
- Quality: 85% (good balance of size/quality)
- CORS is configured for public access
- All images are publicly accessible via S3 URL




