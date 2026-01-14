# Trial Invite Flow - Manual Test Checklist

## Prerequisites
- SuperAdmin access to `/superadmin/companies`
- Zoho email configured (`EMAIL_USER`, `EMAIL_PASS` in Vercel)
- Supabase Dashboard configured:
  - Site URL: `https://crm.pashkovsky-group.com`
  - Redirect URLs: `https://crm.pashkovsky-group.com/auth/callback`

## Test 1: Invite New User (No Account)

1. **As SuperAdmin**, navigate to `/superadmin/companies`
2. Select a company or note its `company_id`
3. Call API:
   ```bash
   curl -X POST https://crm.pashkovsky-group.com/admin-api/invite-user \
     -H "Content-Type: application/json" \
     -H "Cookie: superadmin_session=..." \
     -d '{
       "email": "test-new@example.com",
       "company_id": "YOUR_COMPANY_ID",
       "role": "owner"
     }'
   ```
4. **Expected:**
   - Response: `{ "ok": true, "user_id": "...", "magic_link": "...", "email_sent": true }`
   - Email received with magic link
   - User created in `auth.users`
   - Membership created in `company_members`
   - Trial subscription created in `company_subscriptions` (if missing)

## Test 2: Invite Existing User

1. Use an email that already exists in `auth.users`
2. Call same API endpoint
3. **Expected:**
   - Response: `{ "ok": true, "user_id": "...", "magic_link": "...", "email_sent": true }`
   - Email received with magic link
   - Membership upserted (updated if exists, created if not)
   - Trial subscription created (if missing)

## Test 3: Magic Link Login (Chrome)

1. Click magic link from email
2. **Expected:**
   - Redirects to `/auth/callback?code=...&next=/app`
   - Cookies set: `sb-*-auth-token` (check DevTools → Application → Cookies)
   - Redirects to `/app`
   - `/app` redirects to `/app/admin`
   - No infinite loading spinner
   - Trial subscription exists in `company_subscriptions` with `status='trialing'`

## Test 4: Magic Link Login (Safari)

1. Open Safari (or Safari Private Window)
2. Click magic link from email
3. **Expected:**
   - Same behavior as Chrome
   - Cookies visible in Safari DevTools
   - No localStorage dependency (check: no `sb-*` keys in localStorage)

## Test 5: Debug Endpoint

1. After login, call:
   ```bash
   curl https://crm.pashkovsky-group.com/api/debug/auth \
     -H "Cookie: sb-*-auth-token=..."
   ```
2. **Expected:**
   ```json
   {
     "authenticated": true,
     "user_id": "...",
     "email": "test-new@example.com",
     "has_cookies": true,
     "cookie_count": 2,
     "cookie_names": ["sb-*-auth-token", "sb-*-auth-token.0"]
   }
   ```

## Test 6: Idempotent Trial Creation

1. Invite user and login (trial created)
2. Call `/api/auth/post-login` again:
   ```bash
   curl -X POST https://crm.pashkovsky-group.com/api/auth/post-login \
     -H "Content-Type: application/json" \
     -H "Cookie: sb-*-auth-token=..." \
     -d '{"user_id": "USER_ID"}'
   ```
3. **Expected:**
   - Response: `{ "ok": true, "trial_ensured": true, "company_id": "..." }`
   - Trial subscription NOT shortened (check `trial_ends_at` timestamp)
   - If subscription already active/paid, no changes made

## Test 7: RLS Policies

1. Login as invited user
2. Query `company_members`:
   ```sql
   SELECT * FROM company_members WHERE user_id = 'USER_ID';
   ```
3. Query `companies`:
   ```sql
   SELECT * FROM companies WHERE id IN (
     SELECT company_id FROM company_members WHERE user_id = 'USER_ID'
   );
   ```
4. **Expected:**
   - Both queries return data (RLS allows access)
   - Join `company_members` with `companies!inner` works

## Test 8: Multiple Companies

1. Invite same user to second company
2. Login via magic link
3. **Expected:**
   - `/api/companies/me` returns newest company (or owner company if exists)
   - User can access both companies via `/api/companies/me` (if RLS allows)

## Common Issues & Solutions

### Issue: Magic link redirects to `/login?error=missing_code`
- **Cause:** Supabase Redirect URLs not configured
- **Fix:** Add `https://crm.pashkovsky-group.com/auth/callback` to Supabase Dashboard → Authentication → URL Configuration → Redirect URLs

### Issue: Cookies not set in Safari
- **Cause:** Cookie options incorrect
- **Fix:** Check callback route sets `httpOnly`, `secure`, `sameSite` correctly

### Issue: Trial not created
- **Cause:** `ensure_company_trial` function not called or failed
- **Fix:** Check server logs for `[PostLogin]` or `[AppPage]` messages

### Issue: RLS blocking company access
- **Cause:** RLS policies not applied correctly
- **Fix:** Run migration `032_trial_invite_flow.sql` to ensure policies exist

## Verification Queries

```sql
-- Check user exists
SELECT id, email FROM auth.users WHERE email = 'test-new@example.com';

-- Check membership
SELECT * FROM company_members WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'test-new@example.com'
);

-- Check trial subscription
SELECT * FROM company_subscriptions WHERE company_id = 'YOUR_COMPANY_ID';

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename IN ('companies', 'company_members');
```




