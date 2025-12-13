# Deals Empty - Troubleshooting Guide

## Quick Checks

### 1. Check Browser Console
Open browser DevTools (F12) → Console tab
Look for errors like:
- `Missing Supabase env`
- `Unauthorized`
- Network errors

### 2. Check Network Tab
Open DevTools → Network tab
Look for `/admin-api/deals` request:
- Status should be `200`
- Response should show `{ data: [...], count: ... }`
- If `500`: Check server logs for Supabase connection errors
- If `401`: Check ADMIN_TOKEN

### 3. Check Environment Variables

Make sure `.env.local` has:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_TOKEN=your-admin-token
```

**Important:** 
- Use `SUPABASE_SERVICE_ROLE_KEY` (not `SUPABASE_ANON_KEY`)
- Service Role Key bypasses RLS policies
- Restart dev server after changing `.env.local`

### 4. Check Database

#### Option A: Via Supabase Dashboard
1. Go to Supabase Dashboard → Table Editor
2. Check if `deals` table exists
3. Check if it has any rows
4. If empty, create a test deal manually

#### Option B: Via SQL Editor
```sql
-- Check if table exists
SELECT * FROM deals LIMIT 10;

-- Count deals
SELECT COUNT(*) FROM deals;

-- Check table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'deals';
```

### 5. Check RLS Policies

In Supabase Dashboard → Authentication → Policies:

Make sure Service Role Key can access `deals`:
- Service Role Key bypasses RLS, but check if table has policies
- If using anon key, you need RLS policies

### 6. Create a Test Deal

#### Via Admin Panel:
1. Go to `/admin/deals`
2. Click "Add New Deal" button
3. Fill in required fields
4. Save

#### Via API:
```bash
curl -X POST http://localhost:3000/admin-api/deals \
  -H "x-admin-token: YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Test Customer",
    "customer_phone": "0501234567",
    "stage": "new",
    "price": 10000,
    "currency": "ILS"
  }'
```

#### Via Supabase Dashboard:
1. Go to Table Editor → `deals`
2. Click "Insert" → "Insert row"
3. Fill in fields and save

## Common Issues

### Issue 1: "Missing Supabase env"
**Cause:** Environment variables not set
**Fix:** Add to `.env.local` and restart dev server

### Issue 2: "Unauthorized"
**Cause:** Wrong ADMIN_TOKEN
**Fix:** 
- Check `.env.local` has correct `ADMIN_TOKEN`
- Check browser localStorage has matching token
- Clear localStorage and re-enter token

### Issue 3: Empty array but no error
**Cause:** No deals in database
**Fix:** Create deals via admin panel or Supabase dashboard

### Issue 4: Database connection error
**Cause:** Wrong Supabase URL or Service Role Key
**Fix:** 
- Verify URL format: `https://xxxxx.supabase.co`
- Verify Service Role Key (starts with `eyJ...`)
- Check Supabase project is active

### Issue 5: RLS blocking access
**Cause:** Using anon key instead of service role key
**Fix:** Use `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS)

## Quick Test

Run this in browser console (on `/admin/deals` page):

```javascript
// Check if API is accessible
fetch('/admin-api/deals', {
  headers: { 'x-admin-token': localStorage.getItem('admin_token') }
})
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

Should return: `{ data: [...], count: ... }`

## Still Not Working?

1. Check server logs (terminal where `npm run dev` is running)
2. Check Supabase logs (Dashboard → Logs)
3. Verify table name is exactly `deals` (case-sensitive)
4. Try creating a deal directly in Supabase dashboard
5. Check if other tables (like `leads`) work




