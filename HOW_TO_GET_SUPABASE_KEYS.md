# How to Get Supabase Service Role Key

## Step-by-Step Guide

### Step 1: Go to Supabase Dashboard
1. Open: https://supabase.com/dashboard
2. Sign in with your account

### Step 2: Select Your Project
- Click on your project name from the list
- If you don't have a project, create one first

### Step 3: Navigate to API Settings
1. In the left sidebar, click **Settings** (gear icon at the bottom)
2. Click **API** in the settings menu

### Step 4: Find Your Keys
You'll see several sections:

#### Project URL
- This is your `SUPABASE_URL`
- Format: `https://xxxxx.supabase.co`
- Copy this entire URL

#### Project API keys
You'll see multiple keys:

1. **anon public** key
   - This is `SUPABASE_ANON_KEY`
   - Starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - Used for client-side (browser) access
   - Respects RLS (Row Level Security) policies

2. **service_role** key (SECRET) ⚠️
   - This is `SUPABASE_SERVICE_ROLE_KEY`
   - Also starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - **This is the one you need!**
   - Click the **eye icon** or **"Reveal"** button to show it
   - ⚠️ **WARNING:** This key bypasses all security policies
   - ⚠️ **NEVER** expose it in client-side code
   - ⚠️ **ONLY** use it in server-side code (API routes)

### Step 5: Copy the Keys
1. Click the **copy icon** next to each key
2. Or select and copy manually

### Step 6: Add to .env.local

Create or update `.env.local`:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdXItcHJvamVjdC1pZCIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE2NDUxOTIwMDAsImV4cCI6MTk2MDc2ODAwMH0.your-secret-key-here
ADMIN_TOKEN=your-admin-token
```

## Visual Guide

```
Supabase Dashboard
├── Your Project
│   ├── Settings (gear icon)
│   │   └── API
│   │       ├── Project URL → SUPABASE_URL
│   │       └── Project API keys
│   │           ├── anon public → SUPABASE_ANON_KEY
│   │           └── service_role (SECRET) → SUPABASE_SERVICE_ROLE_KEY ⭐
```

## Important Notes

### Why Service Role Key?
- Your admin API routes need full database access
- Service role key bypasses RLS policies
- Required for admin operations (create/update/delete)

### Security
- ✅ **Safe:** Using in `.env.local` (server-side only)
- ✅ **Safe:** Using in API routes (`app/admin-api/`)
- ❌ **DANGEROUS:** Exposing in browser/client code
- ❌ **DANGEROUS:** Committing to git (already in .gitignore)

### If You Can't Find It
1. Make sure you're logged in
2. Make sure you selected the correct project
3. Check if you have admin access to the project
4. Try refreshing the page

## Quick Check

After adding to `.env.local`, restart your dev server and test:

```javascript
// In browser console (on /admin/leads page)
fetch('/admin-api/leads?limit=1', {
  headers: { 'x-admin-token': localStorage.getItem('admin_token') }
})
  .then(r => r.json())
  .then(data => {
    if (Array.isArray(data)) {
      console.log('✅ Success! Supabase connected')
    } else {
      console.log('❌ Error:', data)
    }
  })
```

## Still Can't Find It?

1. **Check project access:** Make sure you're the owner or have admin rights
2. **Check project status:** Project must be active (not paused)
3. **Try different browser:** Sometimes cache issues
4. **Contact project owner:** If you're not the owner, ask them for the key

## Alternative: Create New Project

If you don't have a Supabase project:
1. Go to: https://supabase.com/dashboard
2. Click **"New Project"**
3. Fill in:
   - Name: Your project name
   - Database Password: Create a strong password
   - Region: Choose closest to you
4. Wait for project to initialize (~2 minutes)
5. Then follow steps above to get keys




