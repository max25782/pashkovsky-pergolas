# Trial Invite Flow - Implementation Summary

## Overview
Complete implementation of magic link invite flow with automatic 30-day trial activation for Next.js App Router + Supabase SSR CRM.

## Files Created/Modified

### 1. Database Migration
**File:** `supabase/migrations/032_trial_invite_flow.sql`

**Changes:**
- Created `ensure_company_trial(user_id)` PostgreSQL function (idempotent)
- Improved RLS policies for `companies` table
- Ensured `company_members` RLS allows proper joins
- Function finds newest company membership, creates trial subscription if missing
- Does NOT overwrite active/paid subscriptions (idempotent)

**Key Features:**
- Idempotent: Safe to call multiple times
- Prefers owner role when selecting company
- Only creates trial if subscription missing or canceled
- Preserves existing trial end dates

### 2. Admin API Endpoint
**File:** `apps/crm/app/admin-api/invite-user/route.ts`

**Features:**
- Protected by `requireSuperAdmin` middleware
- Input: `{ email, company_id, role }`
- Creates user if doesn't exist (`admin.createUser`)
- Upserts membership (`company_members` with conflict handling)
- Ensures trial subscription exists (idempotent)
- Generates magic link with `type: 'magiclink'` (PKCE flow, NOT recovery)
- Sends email via Zoho with magic link
- Returns `{ ok, user_id, membership_id, magic_link, email_sent }`

**Important:**
- Uses `type: 'magiclink'` for login (not `recovery`)
- Redirects to `/auth/callback?next=/app`
- Service role client for privileged operations

### 3. Auth Callback Route
**File:** `apps/crm/app/auth/callback/route.ts`

**Changes:**
- Handles `?next=/app` parameter (defaults to `/app`)
- Uses `createServerClient` from `@supabase/ssr`
- Proper cookie accumulation with `setAll/getAll`
- Reads `code` from query (PKCE flow, no hash handling)
- Sets cookies with proper options (`httpOnly`, `secure`, `sameSite`)
- Redirects to `next` parameter after successful auth

**Security:**
- No client-side HTML fallback
- No hash fragment handling
- Cookies are HttpOnly and Secure in production
- Proper SameSite=Lax for CSRF protection

### 4. Post-Login Hook
**File:** `apps/crm/app/api/auth/post-login/route.ts`

**Purpose:**
- Ensures trial subscription exists after login
- Called from `/app/page.tsx` after redirect
- Idempotent: safe to call multiple times

**Features:**
- Verifies authentication
- Validates `user_id` matches authenticated user
- Calls `ensure_company_trial` PostgreSQL function
- Returns `{ ok, trial_ensured, company_id }`

### 5. App Page Update
**File:** `apps/crm/app/app/page.tsx`

**Changes:**
- Calls `ensure_company_trial` after successful company membership check
- Uses service role client to call PostgreSQL function directly
- Non-blocking: errors don't prevent redirect
- Ensures trial exists before redirecting to `/app/admin`

### 6. Debug Endpoint
**File:** `apps/crm/app/api/debug/auth/route.ts`

**Purpose:**
- Diagnostic endpoint to check authentication status
- Shows cookie presence and names
- Useful for debugging Safari/Incognito issues

**Returns:**
```json
{
  "authenticated": true,
  "user_id": "...",
  "email": "...",
  "has_cookies": true,
  "cookie_count": 2,
  "cookie_names": ["sb-*-auth-token", "sb-*-auth-token.0"]
}
```

### 7. Supabase Clients (Already Correct)
**Files:**
- `apps/crm/lib/supabase/client.ts` - Uses `createBrowserClient` from `@supabase/ssr` ✅
- `apps/crm/lib/supabase/server.ts` - Uses `createServerClient` from `@supabase/ssr` ✅

**No changes needed** - already using correct SSR clients.

## Flow Diagram

```
1. SuperAdmin calls POST /admin-api/invite-user
   ↓
2. System creates/updates user in auth.users
   ↓
3. System upserts company_members
   ↓
4. System ensures trial subscription exists
   ↓
5. System generates magic link (type: 'magiclink', PKCE)
   ↓
6. System sends email via Zoho
   ↓
7. User clicks magic link
   ↓
8. Browser redirects to /auth/callback?code=...&next=/app
   ↓
9. Callback exchanges code for session (PKCE)
   ↓
10. Callback sets HttpOnly cookies
    ↓
11. Callback redirects to /app
    ↓
12. /app checks membership, calls ensure_company_trial
    ↓
13. /app redirects to /app/admin
    ↓
14. User sees CRM dashboard with trial active
```

## Security Features

1. **SuperAdmin Protection:** `/admin-api/invite-user` requires SuperAdmin auth
2. **PKCE Flow:** Magic links use PKCE (not implicit flow)
3. **HttpOnly Cookies:** Session stored in cookies, not localStorage
4. **RLS Enforcement:** Database queries respect Row Level Security
5. **Idempotent Operations:** Trial creation safe to retry
6. **Service Role Isolation:** Privileged operations use service role client

## Testing Checklist

See `TRIAL_INVITE_FLOW_TEST.md` for detailed manual test steps.

**Quick Test:**
1. Call `/admin-api/invite-user` with SuperAdmin cookie
2. Check email received with magic link
3. Click magic link in Chrome → verify cookies set → verify redirect to `/app/admin`
4. Click magic link in Safari → verify cookies set → verify redirect works
5. Call `/api/debug/auth` → verify `authenticated: true` and cookies present
6. Check database: `company_subscriptions` has trial with `status='trialing'`

## Environment Variables Required

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
EMAIL_USER=your-zoho-email@zoho.com
EMAIL_PASS=your-zoho-app-password
NEXT_PUBLIC_APP_URL=https://crm.pashkovsky-group.com  # Optional, defaults to Vercel URL
```

## Supabase Dashboard Configuration

1. **Authentication → URL Configuration:**
   - Site URL: `https://crm.pashkovsky-group.com`
   - Redirect URLs: `https://crm.pashkovsky-group.com/auth/callback`

2. **Authentication → Email Templates:**
   - Magic Link template should use `{{ .ConfirmationURL }}`

## Migration Steps

1. **Run SQL Migration:**
   ```bash
   # Apply migration via Supabase Dashboard SQL Editor or CLI
   psql -f supabase/migrations/032_trial_invite_flow.sql
   ```

2. **Deploy Code:**
   - All TypeScript files are ready
   - No build errors
   - Linter passes

3. **Test Flow:**
   - Follow `TRIAL_INVITE_FLOW_TEST.md`

## Known Limitations

1. **Trial Duration:** Fixed 30 days (can be adjusted in migration)
2. **Single Company:** Function selects newest/owner company (can be extended)
3. **Email Required:** Zoho must be configured for email sending
4. **SuperAdmin Only:** Only SuperAdmins can send invites (by design)

## Future Enhancements

1. Custom trial duration per invite
2. Multiple company selection for users
3. Invite expiration (magic link expiry)
4. Invite tracking/analytics
5. Bulk invite API

## Troubleshooting

### Magic link redirects to `/login?error=missing_code`
- **Fix:** Add redirect URL to Supabase Dashboard

### Cookies not set in Safari
- **Fix:** Check cookie options in callback route (`secure`, `sameSite`)

### Trial not created
- **Fix:** Check server logs for `ensure_company_trial` errors
- **Fix:** Verify migration `032_trial_invite_flow.sql` applied

### RLS blocking company access
- **Fix:** Run migration to ensure RLS policies exist
- **Fix:** Check `companies` table has proper policy

## Support

For issues, check:
1. Server logs: `[InviteUser]`, `[Callback]`, `[AppPage]`, `[PostLogin]`
2. Debug endpoint: `/api/debug/auth`
3. Database: `company_subscriptions`, `company_members` tables
4. Supabase Dashboard: Authentication logs




