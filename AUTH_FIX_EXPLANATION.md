# Authentication Fix - Complete Explanation

## 1️⃣ Root Cause Analysis

### Why `code` was missing
- **Problem**: `generateLink` with `type: 'magiclink'` generates **implicit flow** links (hash fragments `#access_token=...`)
- **Why**: Supabase's `magiclink` type is designed for client-side flows, not PKCE server-side flows
- **Solution**: Use `type: 'invite'` which generates **PKCE flow** with `?code=...` query parameter

### Why cookies were not set
- **Problem**: Callback route was handling hash fragments (`#access_token`) which server cannot read
- **Why**: Hash fragments are client-only; server never receives them
- **Solution**: Use PKCE flow exclusively (`?code=...`) which server can read and exchange for session

### Why Safari failed
- **Problem**: Client-side localStorage fallback was attempted when cookies weren't set
- **Why**: Safari blocks localStorage in certain contexts (incognito, cross-site)
- **Solution**: Remove all localStorage auth logic; use **only** HttpOnly cookies

### Why companies were invisible
- **Problem**: RLS policies blocked `companies` table access when joined with `company_members`
- **Why**: User had memberships but RLS prevented reading company details
- **Solution**: SuperAdmin uses service role (bypasses RLS); normal users rely on RLS (no fallback)

### Why this solution is production-ready
- ✅ **PKCE flow only** - secure, server-readable, no hash fragments
- ✅ **HttpOnly cookies only** - Safari-safe, SSR-compatible, no localStorage
- ✅ **Clean separation** - SuperAdmin vs normal user logic
- ✅ **No hacks** - proper Supabase patterns, no client-side magic
- ✅ **Minimal code** - removed all fallbacks and workarounds

---

## 2️⃣ Fixed Magic Link Generation

### Changes Made

**File**: `apps/crm/app/api/superadmin/users/send-magic-link/route.ts`
**File**: `apps/crm/app/api/superadmin/companies/onboard/route.ts`

```typescript
// BEFORE (implicit flow - broken)
await supabaseAdmin.auth.admin.generateLink({
  type: 'magiclink' as any,  // ❌ Generates #access_token
  ...
})

// AFTER (PKCE flow - correct)
await supabaseAdmin.auth.admin.generateLink({
  type: 'invite',  // ✅ Generates ?code=...
  email,
  options: {
    redirectTo: callbackUrl,  // Must match Supabase Dashboard Redirect URLs
  },
})
```

### Why `invite` type works
- `invite` type generates **PKCE flow** links
- Redirects to callback with `?code=...` (server-readable)
- Requires `redirectTo` to match Supabase Dashboard configuration
- Works for both new and existing users (Supabase handles user creation)

### Supabase Dashboard Requirements
- **Auth → URL Configuration → Site URL**: `https://crm.pashkovsky-group.com`
- **Auth → URL Configuration → Redirect URLs**: `https://crm.pashkovsky-group.com/auth/callback`
- **Auth → Providers → Email → Enable PKCE**: ✅ Enabled (default)

---

## 3️⃣ Final Callback Code

**File**: `apps/crm/app/auth/callback/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') || '/app'

  // Validate next parameter (prevent open redirect)
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/app'

  if (!code) {
    return NextResponse.redirect(new URL(`/login?error=missing_code`, url.origin))
  }

  // Accumulate cookies during exchangeCodeForSession
  const cookiesToSet: { name: string; value: string; options: CookieOptions }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSetArray) {
          cookiesToSetArray.forEach((cookie) => cookiesToSet.push(cookie))
        },
      },
    }
  )

  // Exchange code for session (PKCE flow)
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin))
  }

  // Create redirect response and set all cookies
  const response = NextResponse.redirect(new URL(safeNext, url.origin))
  
  cookiesToSet.forEach((cookie) => {
    response.cookies.set({
      name: cookie.name,
      value: cookie.value,
      ...cookie.options,
    })
  })

  return response
}
```

### Key Points
- ✅ **PKCE only** - reads `code` from query, no hash handling
- ✅ **Cookie accumulation** - collects cookies during `exchangeCodeForSession`
- ✅ **Single response** - sets cookies on redirect response
- ✅ **No client-side JS** - pure server-side handler
- ✅ **No fallbacks** - fails cleanly if code missing

---

## 4️⃣ Supabase Client/Server Setup

### Client (`apps/crm/lib/supabase/client.ts`)
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- Uses `createBrowserClient` from `@supabase/ssr`
- Automatically syncs with server-side cookies
- No localStorage access
- Safari/Incognito compatible

### Server (`apps/crm/lib/supabase/server.ts`)
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach((cookie) => cookieStore.set(cookie))
          } catch {
            // Safe to ignore in Server Components
          }
        },
      },
    }
  )
}
```

- Uses `createServerClient` from `@supabase/ssr`
- Reads cookies from Next.js `cookies()` API
- Handles cookie writes gracefully (Server Components can't write)

### Middleware (`apps/crm/middleware.ts`)
- ✅ **No auth logic** - only redirects and public route checks
- ✅ **No DB access** - minimal, fast
- ✅ **No role checks** - handled in layouts/pages

---

## 5️⃣ Fixed companies/me Route

**File**: `apps/crm/app/api/companies/me/route.ts`

### Clean Separation Logic

```typescript
// 1. Get user
const { data: { user } } = await supabase.auth.getUser()

// 2. Early SuperAdmin check
const isAdmin = await isSuperAdmin(user.id)
if (isAdmin) {
  // Use service role (bypass RLS)
  const serviceSupabase = createServiceClient(...)
  const { data: companies } = await serviceSupabase
    .from('companies')
    .select('id, name, created_at, status')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  
  return NextResponse.json({ company_id: companies.id, ... })
}

// 3. Normal user (enforce RLS)
const { data: memberships } = await supabase
  .from('company_members')
  .select('company_id, role, companies!inner (...)')
  .eq('user_id', user.id)

// Select newest company (prefer owner)
// Return 404 if no memberships
```

### Key Changes
- ✅ **Early SuperAdmin exit** - clean separation, no fallbacks
- ✅ **Service role for SuperAdmin** - bypasses RLS correctly
- ✅ **RLS for normal users** - no service role fallback
- ✅ **Removed debug hacks** - clean, production code
- ✅ **Correct error statuses** - 401 for auth, 404 for no company, 500 for errors

---

## 6️⃣ Summary Checklist

### ✅ Magic Link Generation
- [x] Changed `type: 'magiclink'` → `type: 'invite'` (PKCE flow)
- [x] Removed token extraction logic
- [x] Extract PKCE `code` from action_link
- [x] Build callback URL with `?code=...&next=...`

### ✅ Callback Route
- [x] Removed hash fragment handling
- [x] Removed token/verifyOtp fallback
- [x] PKCE-only handler (`?code=...`)
- [x] Cookie accumulation pattern
- [x] Single response with cookies set

### ✅ Supabase Clients
- [x] Client uses `createBrowserClient` (cookie-based)
- [x] Server uses `createServerClient` (cookie-based)
- [x] Removed localStorage references
- [x] Middleware stays minimal (no auth logic)

### ✅ companies/me Route
- [x] Early SuperAdmin detection
- [x] Service role for SuperAdmin (bypass RLS)
- [x] RLS enforcement for normal users
- [x] Removed debug logging
- [x] Clean error handling

### ✅ Testing Requirements
- [ ] Verify Supabase Dashboard: PKCE enabled, Redirect URLs configured
- [ ] Test magic link generation (should have `?code=...`)
- [ ] Test callback route (should set cookies, redirect to `/app`)
- [ ] Test Safari/Incognito (should work without localStorage)
- [ ] Test SuperAdmin access (should bypass RLS)
- [ ] Test normal user access (should enforce RLS)

---

## Production Deployment Steps

1. **Update Supabase Dashboard**:
   - Auth → URL Configuration → Site URL: `https://crm.pashkovsky-group.com`
   - Auth → URL Configuration → Redirect URLs: `https://crm.pashkovsky-group.com/auth/callback`
   - Auth → Providers → Email → Enable PKCE: ✅

2. **Deploy Code**:
   ```bash
   git add apps/crm/app/auth/callback/route.ts
   git add apps/crm/lib/supabase/client.ts
   git add apps/crm/lib/supabase/server.ts
   git add apps/crm/app/api/companies/me/route.ts
   git add apps/crm/app/api/superadmin/users/send-magic-link/route.ts
   git add apps/crm/app/api/superadmin/companies/onboard/route.ts
   git commit -m "Fix auth: PKCE-only flow, cookie-based sessions, clean SuperAdmin handling"
   git push origin master
   ```

3. **Verify**:
   - Generate magic link → should contain `?code=...`
   - Click magic link → should redirect to `/app` with cookies set
   - Check Safari/Incognito → should work without localStorage
   - Check `/api/companies/me` → should return company data

---

## Why This Works

1. **PKCE Flow**: Server-readable `?code=...` instead of client-only `#access_token`
2. **Cookie-Based**: HttpOnly cookies work in Safari, Incognito, SSR, middleware
3. **Clean Separation**: SuperAdmin uses service role; normal users use RLS
4. **No Hacks**: Proper Supabase patterns, no client-side fallbacks
5. **Production-Ready**: Minimal code, correct error handling, secure by default

