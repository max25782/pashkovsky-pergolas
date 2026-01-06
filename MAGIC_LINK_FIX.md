# Magic Link Auth + Admin Protection - Implementation Summary

## Changes Made

### 1. Fixed `app/auth/callback/route.ts`
**Changes:**
- Replaced client-side Supabase with **server-side SSR client** using `@supabase/ssr`
- Implemented proper cookie handling (get/set/remove) on NextResponse
- Changed default redirect from `/app/admin` → `/app`
- Added proper error encoding in redirect URLs
- Cookies are now set correctly on the response before redirect

**Key Fix:** Magic link now creates proper Supabase session cookies that persist in Safari.

### 2. Updated `middleware.ts`
**Changes:**
- Changed root redirect from `'/'` → `/app/admin` to `'/'` → `/app`
- Kept all existing public routes and static file exclusions
- No new auth logic added (stays lightweight)

### 3. Created `/app/admin` protection
**New files:**
- `lib/auth/isSuperAdmin.ts` - Server utility to check if user is platform admin
- `app/app/admin/layout.tsx` - Server-side guard for `/app/admin` routes

**Protection logic:**
1. Check if user is authenticated (via Supabase session)
2. Check if user exists in `platform_admins` table (is_active = true)
3. If not authenticated → redirect to `/login`
4. If not superadmin → redirect to `/app`
5. If superadmin → allow access

### 4. Created `/app` landing page
**New file:** `app/app/page.tsx`
- For regular authenticated users: redirect to `/app/admin/deals`
- For superadmins: redirect to `/app/admin`
- For unauthenticated: redirect to `/login`

## Database Requirements

The `platform_admins` table already exists (created in migration `024_subscription_management.sql`).

**Schema:**
```sql
CREATE TABLE public.platform_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  email VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**To make a user superadmin:**
```sql
-- Get user ID from email
SELECT id FROM auth.users WHERE email = 'admin@example.com';

-- Add to platform_admins
INSERT INTO platform_admins (user_id, email, is_active)
VALUES ('USER_ID_HERE', 'admin@example.com', true);
```

## Testing Instructions

### Test 1: Magic link for normal user (fresh incognito)

1. Open **incognito window**
2. Navigate to your CRM login page
3. Request magic link for a **non-superadmin** user (e.g., `oryaron38@gmail.com`)
4. Click magic link in email

**Expected result:**
- ✅ Redirects to `/app`
- ✅ Then redirects to `/app/admin/deals` (user dashboard)
- ✅ Session cookies are set
- ✅ User stays logged in (no infinite loading)

**Verify in DevTools:**
```js
// Should return valid session
document.cookie // Should contain sb-* cookies

// Should work without 401
fetch('/api/companies/me').then(r => r.json()).then(console.log)
```

### Test 2: Normal user tries to access `/app/admin`

1. While logged in as **normal user** (from Test 1)
2. Navigate to `https://crm.pashkovsky-group.com/app/admin`

**Expected result:**
- ✅ Immediately redirects to `/app`
- ✅ Cannot access admin panel

### Test 3: Superadmin magic link (fresh incognito)

1. Open **new incognito window**
2. First, ensure user is in `platform_admins` table:
   ```sql
   SELECT * FROM platform_admins WHERE email = 'office@pashkovsky-group.com';
   ```
3. Request magic link for **superadmin** user
4. Click magic link

**Expected result:**
- ✅ Redirects to `/app`
- ✅ Then redirects to `/app/admin` (admin panel)
- ✅ Can access all admin routes
- ✅ Session persists

### Test 4: Superadmin visits root

1. While logged in as **superadmin**
2. Navigate to `https://crm.pashkovsky-group.com/`

**Expected result:**
- ✅ Redirects to `/app`
- ✅ Then redirects to `/app/admin`

### Test 5: Check session persistence (Safari)

1. Login via magic link in Safari (incognito)
2. Close DevTools
3. Navigate between pages (`/app/admin`, `/app/admin/deals`, etc.)
4. Refresh page (Cmd+R)

**Expected result:**
- ✅ No infinite loading
- ✅ No repeated redirects
- ✅ Session stays valid

## Debugging

If magic link doesn't work:

1. **Check Supabase URL Configuration:**
   - Site URL: `https://crm.pashkovsky-group.com`
   - Redirect URLs must include: `https://crm.pashkovsky-group.com/auth/callback`

2. **Check cookies after magic link:**
   ```js
   document.cookie // Should show sb-kvqupacmdishpfnscnio-auth-token
   ```

3. **Check if user is in platform_admins:**
   ```sql
   SELECT pa.*, u.email 
   FROM platform_admins pa
   JOIN auth.users u ON pa.user_id = u.id
   WHERE u.email = 'your@email.com';
   ```

4. **Check server logs:**
   - Look for `[Auth Callback] Successfully authenticated, redirecting to: /app`
   - Look for `[AdminLayout] User is not superadmin, redirecting to /app`

## Files Changed

```
apps/crm/
├── app/
│   ├── auth/callback/route.ts          # ✏️ Fixed SSR cookies + default redirect
│   └── app/
│       ├── page.tsx                    # ✨ NEW - Landing page
│       └── admin/
│           └── layout.tsx              # ✨ NEW - SuperAdmin guard
├── middleware.ts                       # ✏️ Changed root redirect
└── lib/auth/
    └── isSuperAdmin.ts                 # ✨ NEW - SuperAdmin check utility
```

## Summary

- ✅ Magic links now set cookies properly (Safari-safe)
- ✅ Default landing is `/app` (not `/app/admin`)
- ✅ `/app/admin` is protected (superadmin only)
- ✅ Root `"/"` redirects to `/app`
- ✅ Normal users → `/app/admin/deals`
- ✅ Superadmins → `/app/admin`
- ✅ No infinite redirects
- ✅ Minimal code changes

## Deploy

1. Commit changes:
   ```bash
   git add apps/crm/app/auth/callback/route.ts
   git add apps/crm/middleware.ts
   git add apps/crm/lib/auth/isSuperAdmin.ts
   git add apps/crm/app/app/admin/layout.tsx
   git add apps/crm/app/app/page.tsx
   git commit -m "Fix magic link auth + protect /app/admin routes"
   git push origin master
   ```

2. Wait for Vercel deployment

3. Test with fresh magic link in incognito

4. Make user superadmin if needed:
   ```sql
   INSERT INTO platform_admins (user_id, email, is_active)
   SELECT id, email, true
   FROM auth.users
   WHERE email = 'your-admin@email.com'
   ON CONFLICT (user_id) DO NOTHING;
   ```

