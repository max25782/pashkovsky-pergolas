-- STEP 2: Link your new auth.users to existing company
-- Run this AFTER you register at /register

-- =====================================================
-- INSTRUCTIONS:
-- 1. Register at http://localhost:3001/register with your email
-- 2. Confirm email (check Supabase Auth emails)
-- 3. Get your auth.users.id from the query below
-- 4. Update company_members to link your auth user to your company
-- =====================================================

-- Step 1: Find your auth.users.id
SELECT 
  'Your new auth user' as info,
  id as auth_user_id,
  email,
  created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 1;

-- Copy the 'auth_user_id' from above, then run:

-- Step 2: Update company_members (REPLACE 'YOUR_AUTH_USER_ID' with actual ID)
UPDATE public.company_members
SET user_id = 'YOUR_AUTH_USER_ID_HERE'  -- e.g. 'abc123-...'
WHERE company_id = '6998295e-89ae-4e3d-afd2-8c2b0333eac2'; -- Your Pashkovsky Group company

-- Step 3: Verify the update
SELECT 
  cm.id,
  cm.user_id,
  au.email,
  cm.company_id,
  c.name as company_name,
  cm.role
FROM public.company_members cm
JOIN auth.users au ON au.id = cm.user_id
JOIN public.companies c ON c.id = cm.company_id
WHERE cm.company_id = '6998295e-89ae-4e3d-afd2-8c2b0333eac2';

-- Expected result: Your email linked to Pashkovsky Group as owner

-- =====================================================
-- ALTERNATIVE: If setup-company API created a NEW company:
-- Delete the duplicate and keep your original
-- =====================================================

-- Check if there are duplicate companies
SELECT id, name, slug, plan, created_at 
FROM public.companies 
WHERE name LIKE '%Pashkovsky%'
ORDER BY created_at;

-- If you have a duplicate, delete the newer one:
-- DELETE FROM public.companies WHERE id = 'NEW_DUPLICATE_ID';

