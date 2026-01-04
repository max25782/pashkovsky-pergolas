# SuperAdmin Manual Company Onboarding - Testing Guide

## ✅ Implementation Complete

All components have been successfully implemented and built:

1. **Service Layer**: `apps/crm/lib/services/company-onboarding-service.ts`
2. **API Route**: `apps/crm/app/api/superadmin/companies/onboard/route.ts`
3. **UI Component**: `apps/crm/components/superadmin/CompanyOnboardingForm.tsx`
4. **Page Integration**: `apps/crm/app/superadmin/companies/page.tsx`

## 🧪 How to Test the Onboarding Flow

### Prerequisites

1. **SuperAdmin Access Required**
   - You must be logged in as a SuperAdmin
   - The SuperAdmin session cookie (`superadmin_session`) must be present
   - If not already a SuperAdmin, you need to:
     - Find your user_id: `SELECT id, email FROM auth.users WHERE email = 'your@email.com';`
     - Insert into platform_admins: `INSERT INTO platform_admins (user_id, role) VALUES ('your-user-id', 'SUPERADMIN');`
     - Login via `/login` with SuperAdmin phone auth

2. **Dev Server Running**
   - CRM app should be running on `http://localhost:3001`
   - Check terminal 1.txt - server is currently running

### Testing Steps

#### Step 1: Navigate to SuperAdmin Companies Page

```
URL: http://localhost:3001/superadmin/companies
```

You should see:
- "Onboard New Company" form at the top
- Email input field
- Checkbox for "Generate magic login link"
- Blue "Create Company + Give Full Access" button
- List of existing companies below

#### Step 2: Test with Target Email

**Email to test**: `oryaron38@gmail.com`

1. Enter the email in the input field
2. Check/uncheck the "Generate magic login link" checkbox
3. Click "Create Company + Give Full Access"
4. Wait for the success message

#### Step 3: Verify Success Response

The success message should show:
- ✅ "Company Created Successfully!"
- **Company name**: "Oryaron38" (derived from email prefix)
- **Company ID**: UUID
- **User ID**: UUID
- **Magic Login Link**: (if checkbox was checked)
  - Full URL to copy/share
  - "Copy" button to copy to clipboard

#### Step 4: Database Verification

Check the following tables in Supabase:

**1. auth.users**
```sql
SELECT id, email, email_confirmed_at, created_at 
FROM auth.users 
WHERE email = 'oryaron38@gmail.com';
```
- Should have 1 record
- `email_confirmed_at` should NOT be null (auto-confirmed)

**2. public.users**
```sql
SELECT id, email, full_name, locale 
FROM users 
WHERE email = 'oryaron38@gmail.com';
```
- Should have 1 record
- `full_name` should be "oryaron38"

**3. public.companies**
```sql
SELECT id, name, slug, status, plan, primary_email, settings 
FROM companies 
WHERE primary_email = 'oryaron38@gmail.com';
```
- Should have 1 record
- `name`: "Oryaron38"
- `slug`: "oryaron38"
- `status`: "active"
- `plan`: "enterprise"
- `settings` should contain: `{"source": "manual", "onboarded_by": "superadmin"}`

**4. public.company_members**
```sql
SELECT cm.*, u.email 
FROM company_members cm
JOIN users u ON u.id = cm.user_id
WHERE u.email = 'oryaron38@gmail.com';
```
- Should have 1 record
- `role`: "owner"
- `status`: "active"

**5. public.company_subscriptions**
```sql
SELECT cs.*, sp.plan_key 
FROM company_subscriptions cs
JOIN subscription_plans sp ON sp.id = cs.plan_id
JOIN companies c ON c.id = cs.company_id
WHERE c.primary_email = 'oryaron38@gmail.com';
```
- Should have 1 record
- `status`: "active"
- `payment_provider`: "manual"
- `billing_cycle`: "manual"
- `plan_key`: "enterprise"
- `auto_renew`: false

**6. public.subscription_history**
```sql
SELECT sh.*, sp.plan_key, sh.change_reason 
FROM subscription_history sh
JOIN subscription_plans sp ON sp.id = sh.new_plan_id
JOIN companies c ON c.id = sh.company_id
WHERE c.primary_email = 'oryaron38@gmail.com';
```
- Should have 1 record
- `change_reason`: "manual free access by SuperAdmin"
- `plan_key`: "enterprise"

#### Step 5: Test Magic Login Link

If you generated a magic login link:

1. Copy the magic link from the success message
2. Open in a new incognito/private browser window
3. The link should:
   - Automatically log the user in
   - Redirect to `/app` (CRM dashboard)
   - Show the company name "Oryaron38" in the UI
   - Give full access to all enterprise features

#### Step 6: Verify User Can Access CRM

1. As the newly onboarded user, verify access to:
   - Dashboard (`/app/admin`)
   - Deals (`/app/admin/deals`)
   - Leads (`/app/admin/leads`)
   - AI Director (`/app/admin/ai-director`)
   - Analytics (`/app/admin/ai-analytics`)
   - Settings (`/app/settings/company`)
   - Integrations (`/app/settings/integrations`)

2. All features should be unlocked (no "upgrade required" messages)

## 🔐 Security Tests

### Test 1: Non-SuperAdmin Cannot Access

1. Logout from SuperAdmin
2. Try to access `http://localhost:3001/superadmin/companies`
3. Should be redirected to login or show unauthorized

### Test 2: API Endpoint Protected

Try to call the API without SuperAdmin session:

```bash
curl -X POST http://localhost:3001/api/superadmin/companies/onboard \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

Expected: 401 Unauthorized

### Test 3: Invalid Email Validation

1. Try submitting with invalid email formats:
   - Empty string
   - "notanemail"
   - "missing@domain"
   - "spaces in@email.com"

Expected: Error message "Invalid email format"

## 🐛 Edge Cases to Test

### Test 1: Duplicate User

1. Create a company for `oryaron38@gmail.com`
2. Try to create another company for the same email
3. Expected behavior:
   - Should find existing user
   - Create new company or reuse existing
   - Update membership to owner
   - Should NOT fail

### Test 2: Without Magic Link

1. Uncheck "Generate magic login link"
2. Submit the form
3. Success message should NOT show magic link section

### Test 3: Network Error Handling

Simulate network failure (disconnect internet) and submit form:
- Should show error message
- Form should remain filled (not reset)
- Can retry after reconnecting

## 📊 Expected Logs

Check browser console and server logs for:

**Client-side logs:**
```
[CompanyOnboardingForm] Onboarding successful: {company_name, company_id, user_id, magic_link_url}
```

**Server-side logs:**
```
[API /superadmin/companies/onboard] Starting onboarding for: oryaron38@gmail.com
[Onboarding] Checking if user exists: oryaron38@gmail.com
[Onboarding] Creating new user: oryaron38@gmail.com  (or "User already exists")
[Onboarding] Creating company: Oryaron38
[Onboarding] Company created: <company_id>
[Onboarding] Assigning owner role: {companyId, userId}
[Onboarding] Owner role assigned
[Onboarding] Granting enterprise access: <company_id>
[Onboarding] Enterprise access granted
[Onboarding] Generating magic link for: oryaron38@gmail.com
[Onboarding] Magic link generated: <action_link>
[Onboarding] Onboarding completed successfully
[API /superadmin/companies/onboard] Onboarding successful: {company_id, user_id}
```

## ✅ Success Criteria

All of the following must be true:

- [ ] Form renders correctly on `/superadmin/companies`
- [ ] Email validation works
- [ ] SuperAdmin auth blocks non-admins
- [ ] User is created/found in `auth.users`
- [ ] Company is created with correct name and slug
- [ ] User is assigned as owner in `company_members`
- [ ] Enterprise subscription is created
- [ ] Subscription history is logged
- [ ] Magic link is generated (if requested)
- [ ] Magic link logs user in successfully
- [ ] User has full access to all CRM features
- [ ] No errors in console or server logs
- [ ] Build completes successfully (✅ already verified)

## 🎯 Next Steps After Testing

If all tests pass:

1. **Share Magic Link** with oryaron38@gmail.com
2. **Verify** they can log in and access the CRM
3. **Monitor** for any issues in production logs
4. **Document** this process for future manual onboardings

If tests fail:

1. Check Supabase environment variables
2. Verify SuperAdmin session is valid
3. Check database table structures match migration
4. Review server logs for detailed error messages

## 🔧 Troubleshooting

**Issue**: "Unauthorized: SuperAdmin access required"
- **Solution**: Login as SuperAdmin first, check platform_admins table

**Issue**: "Failed to create user"
- **Solution**: Check Supabase service role key, verify auth is enabled

**Issue**: "No default trial plan found"
- **Solution**: Run migration 024_subscription_management.sql to create plans

**Issue**: Magic link doesn't work
- **Solution**: Check NEXT_PUBLIC_CRM_URL or NEXT_PUBLIC_APP_URL env vars

**Issue**: Company already exists
- **Solution**: This is expected behavior, check if slug conflict or intentional reuse

---

**Build Status**: ✅ Successfully built (no TypeScript errors)
**Implementation Status**: ✅ Complete (all 4 todos finished)
**Ready for Testing**: ✅ Yes

