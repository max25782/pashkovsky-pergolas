# Fix "Missing Supabase env" Error

## Problem
You're getting `500: Missing Supabase env` because `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is not set in `.env.local`.

## Solution

### Step 1: Get Your Supabase Credentials

1. Go to: https://supabase.com/dashboard
2. Select your project
3. Go to: **Settings** → **API**
4. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role key** (secret) → `SUPABASE_SERVICE_ROLE_KEY`
   - **anon public key** → `SUPABASE_ANON_KEY` (optional)

### Step 2: Add to .env.local

Create or update `.env.local` with:

```env
# Supabase Configuration (REQUIRED)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Admin Token (REQUIRED)
ADMIN_TOKEN=your-admin-token
```

**Important:**
- Use **service_role** key (not anon key) for `SUPABASE_SERVICE_ROLE_KEY`
- Service role key bypasses RLS policies
- Never commit `.env.local` to git (it's already in .gitignore)

### Step 3: Restart Dev Server

```powershell
# Stop current server (Ctrl+C)
npm run dev
```

### Step 4: Verify

After restarting, check:
1. No more "Missing Supabase env" errors
2. Leads page loads
3. Deals page loads

## Quick Setup Script

Run:
```powershell
.\setup-supabase-env.ps1
```

This will:
- Copy Supabase vars from `.env` to `.env.local` (if they exist)
- Show you what's missing
- Create `.env.local` if it doesn't exist

## Manual Setup

If the script doesn't work, manually create `.env.local`:

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdXItcHJvamVjdC1pZCIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE2NDUxOTIwMDAsImV4cCI6MTk2MDc2ODAwMH0.xxxxx
ADMIN_TOKEN=your-admin-token
```

## Common Issues

### Issue 1: Using Anon Key Instead of Service Role Key
**Symptom:** Works sometimes, fails other times
**Fix:** Use `SUPABASE_SERVICE_ROLE_KEY` (service_role key)

### Issue 2: Wrong URL Format
**Symptom:** Connection errors
**Fix:** URL should be `https://xxxxx.supabase.co` (no trailing slash)

### Issue 3: Variables Not Loading
**Symptom:** Still getting "Missing Supabase env" after adding vars
**Fix:** 
- Make sure file is named exactly `.env.local` (not `.env.local.txt`)
- Restart dev server
- Check for typos in variable names

## Verify Setup

Check if variables are loaded (in server terminal):
```javascript
// This won't work in browser, only shows in server logs
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Missing')
console.log('SERVICE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing')
```

Or test API directly:
```javascript
fetch('/admin-api/leads?limit=1', {
  headers: { 'x-admin-token': localStorage.getItem('admin_token') }
})
  .then(r => r.json())
  .then(console.log)
```

Should return leads array, not error.




