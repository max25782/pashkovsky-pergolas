# 🗑️ How to Delete Images from Gallery

## ✅ Updated Feature (Dec 2025)

Your gallery admin now has a **Delete UI** with visual thumbnails!

---

## 📍 Access Delete UI

```
http://localhost:3000/he/admin/gallery
```

**Production:**
```
https://crm.pashkovsky-group.com/he/admin/gallery
```

---

## 🎯 How to Delete Images

### 1️⃣ **Open Gallery Admin**
Navigate to Admin Gallery page

### 2️⃣ **Switch to "ניהול תמונות" Tab**
Click the 🗑️ **ניהול תמונות** button at the top

### 3️⃣ **Select Category**
Choose category from dropdown:
- `pergulas` - פרגולות
- `rails` - מעקות
- `mestor` - מסתורי כביסה
- `windows` - חלונות
- `fromShetah` - מהשטח
- `fancy` - גדרות
- `dgamim` - דגמים

### 4️⃣ **View Images**
You'll see a grid of all images in that category with:
- ✅ Thumbnail preview
- ✅ Filename
- ✅ Upload date
- ✅ Image count

### 5️⃣ **Delete Image**
**Hover over image** → Click 🗑️ **Delete** button

**Confirm deletion** → Image will be:
- ✅ Removed from S3
- ✅ Removed from database
- ✅ Removed from website (immediately)

### 6️⃣ **View Image (Optional)**
Click 👁️ **Eye** icon to open image in new tab

---

## 🎨 UI Features

### **Two Tabs:**

| Tab | Purpose |
|---|---|
| 📤 **העלאת תמונות** | Upload new images |
| 🗑️ **ניהול תמונות** | View and delete images |

### **Manage Images Tab:**
- ✅ Grid layout with thumbnails
- ✅ Category selector (shows image count)
- ✅ Hover to reveal actions
- ✅ Delete confirmation dialog
- ✅ Refresh button
- ✅ Success/error messages
- ✅ Loading states

---

## ⚠️ Important Notes

### **Deletion is Permanent:**
- ❌ No undo
- ❌ No trash/recycle bin
- ✅ Always confirm before deleting

### **What Gets Deleted:**
1. **S3 file** - Physical image file
2. **Database record** - Metadata entry
3. **Website** - Image disappears immediately

### **Safe to Delete:**
- ✅ Duplicate images
- ✅ Wrong images
- ✅ Low quality images
- ✅ Test uploads

### **DO NOT Delete:**
- ❌ Currently used images
- ❌ Images referenced in projects
- ❌ If unsure, ask first!

---

## 🔧 Technical Details

### **API Endpoint:**
```
DELETE /admin-api/gallery/images?id={IMAGE_ID}
```

### **Headers:**
```
x-admin-token: YOUR_ADMIN_TOKEN
```

### **Response:**
```
200 OK - Deleted successfully
404 Not Found - Image not found
401 Unauthorized - Invalid token
```

### **Backend Logic:**
1. Fetch image metadata from database
2. Delete database record
3. Delete file from S3 (using storage_path)
4. Return success/error

### **Files Modified:**
- `app/[locale]/admin/gallery/page.tsx` - Added UI
- `app/admin-api/gallery/images/route.ts` - DELETE endpoint (already existed)
- `lib/s3-upload.ts` - S3 delete function (already existed)

---

## 🐛 Troubleshooting

### **"Failed to fetch images"**
- Check admin token is correct
- Check category exists
- Check network connection

### **"Failed to delete image"**
- Check S3 credentials are valid
- Check image still exists
- Check AWS permissions

### **Images still visible after delete**
- Hard refresh browser (Ctrl + Shift + R)
- Clear browser cache
- Check if deleted from correct category

### **Deleted from database but still in S3**
- Check AWS credentials in `.env`
- Check S3 bucket name is correct
- Run manual cleanup script:
  ```bash
  node scripts/cleanup-orphaned-s3-files.mjs
  ```

---

## 📊 Statistics

After deletion, you'll see:
- ✅ Success message
- ✅ Updated image count
- ✅ Refreshed grid

---

## 🎯 Quick Actions

### **Delete All Images from Category:**
Use Supabase SQL Editor:
```sql
-- ⚠️ DANGEROUS - Deletes ALL images from category
DELETE FROM gallery_images 
WHERE category_key = 'rails';
```

**Note:** This only deletes database records. S3 files remain. Use cleanup script to remove orphaned files.

---

## ✅ Best Practices

1. **Review before delete** - Check image is correct
2. **Delete in batches** - Don't rush
3. **Keep backups** - S3 versioning enabled?
4. **Test first** - Try on test category
5. **Document** - Note what you deleted (if important)

---

## 🚀 Future Enhancements

Possible features to add:
- [ ] Bulk delete (select multiple)
- [ ] Trash bin (restore deleted)
- [ ] Search/filter images
- [ ] Sort by date/name
- [ ] Image details modal
- [ ] Rename images
- [ ] Move to another category

---

## 📞 Need Help?

If you encounter issues:
1. Check browser console (F12)
2. Check server logs (Vercel logs)
3. Check Supabase logs
4. Contact developer

---

**Enjoy your new delete feature!** 🎉


