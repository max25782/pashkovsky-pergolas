# Sketch Modal Setup Guide

## ✅ What's Been Created

1. **SketchModal Component** (`components/admin/SketchModal.tsx`)
   - Full-featured drawing canvas with Fabric.js
   - Touch and mouse support
   - Multiple drawing tools
   - Pergola shape templates

2. **API Endpoint** (`app/admin-api/deals/sketch/route.ts`)
   - Saves image to Supabase Storage
   - Saves JSON data to database

3. **Integration**
   - Added "Open sketch" button to DealModal
   - Sketch preview in deal view
   - Auto-save functionality

## 📦 Installation

### Step 1: Install Fabric.js

```bash
npm install fabric
```

### Step 2: Add TypeScript Types

The types file `types/fabric.d.ts` has been created. Make sure your `tsconfig.json` includes it:

```json
{
  "compilerOptions": {
    "typeRoots": ["./node_modules/@types", "./types"]
  }
}
```

### Step 3: Create Supabase Storage Bucket

1. Go to Supabase Dashboard → **Storage**
2. Click **"New bucket"**
3. Name: `deal-files`
4. Make it **Public** (or configure RLS policies)
5. Click **Create**

### Step 4: Database Columns

Make sure your `deals` table has these columns:

```sql
ALTER TABLE deals 
ADD COLUMN IF NOT EXISTS sketch_image_url TEXT;

ALTER TABLE deals 
ADD COLUMN IF NOT EXISTS sketch_json JSONB;
```

## 🎨 Features

### Drawing Tools
- **Pencil** - Free-hand drawing
- **Rectangle** - Draw rectangles
- **Circle** - Draw circles
- **Line** - Draw straight lines
- **Pergola ▭** - Rectangular pergola with grid
- **Pergola Г** - L-shaped pergola with grid

### Actions
- **Undo** - Undo last action (20 step history)
- **Clear** - Clear entire canvas
- **Save** - Save to Supabase Storage and database

### Mobile Support
- ✅ Touch support enabled
- ✅ Responsive canvas
- ✅ Optimized for tablets

## 🚀 Usage

1. Open any deal in the admin panel
2. Click **"Открыть эскиз"** (Open sketch) button
3. Draw using the tools
4. Click **"Сохранить"** (Save)

## 📁 File Structure

```
components/admin/
  ├── SketchModal.tsx          # Main drawing modal
  ├── DealModal.tsx            # Updated with sketch button
  └── deal-types.ts            # Updated with sketch fields

app/admin-api/deals/
  └── sketch/
      └── route.ts             # API endpoint for saving

types/
  └── fabric.d.ts              # TypeScript types
```

## 🔧 Configuration

### Canvas Size
Edit `SketchModal.tsx` line ~45:
```typescript
width: 800,  // Change canvas width
height: 600, // Change canvas height
```

### Drawing Brush
Edit `SketchModal.tsx` line ~50:
```typescript
canvas.freeDrawingBrush.width = 3  // Line width
canvas.freeDrawingBrush.color = '#000000'  // Line color
```

### Storage Bucket
Edit `app/admin-api/deals/sketch/route.ts` line ~30:
```typescript
.from('deal-files')  // Change bucket name
```

## 🐛 Troubleshooting

### "fabric is not defined"
- Make sure `npm install fabric` completed
- Restart dev server

### "Missing Supabase env"
- Check `.env.local` has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Restart dev server

### "Storage bucket not found"
- Create bucket `deal-files` in Supabase Storage
- Make it public or configure RLS policies

### Canvas not showing
- Check browser console for errors
- Make sure Fabric.js loaded correctly
- Try hard refresh (Ctrl+Shift+R)

## 📝 API Usage

### Save Sketch
```typescript
POST /admin-api/deals/sketch
Headers:
  x-admin-token: your-admin-token
Body (FormData):
  dealId: string
  image: File (PNG blob)
  sketchJson: string (JSON)
```

### Response
```json
{
  "success": true,
  "imageUrl": "https://...supabase.co/storage/.../sketch.png",
  "deal": { ... }
}
```

## 🎯 Next Steps

1. Test the sketch modal
2. Customize colors/styles if needed
3. Add more pergola shapes if required
4. Configure storage bucket permissions

## 💡 Tips

- Use **Pergola ▭** for rectangular projects
- Use **Pergola Г** for L-shaped projects
- Undo works for last 20 actions
- Saved sketches can be edited later
- JSON data preserves all drawing objects

