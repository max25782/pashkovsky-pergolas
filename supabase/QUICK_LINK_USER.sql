-- QUICK: Link your auth user to Pashkovsky Group company
-- Copy and run this in Supabase SQL Editor

-- Step 1: Verify your auth user exists
SELECT 
  'Your auth user' as info,
  id, 
  email, 
  email_confirmed_at,
  created_at
FROM auth.users 
WHERE email = 'office@pashkovsky-group.com'
ORDER BY created_at DESC
LIMIT 1;

-- Step 2: Link to your company (replace USER_ID if needed)
UPDATE public.company_members
SET user_id = '41bc1d19-aa1f-4427-b739-98003bea8528'  -- Your user ID
WHERE company_id = '6998295e-89ae-4e3d-afd2-8c2b0333eac2'  -- Pashkovsky Group
RETURNING *;

-- Step 3: Verify the link
SELECT 
  'Verification' as step,
  cm.id,
  au.email,
  c.name as company_name,
  cm.role,
  cm.permissions
FROM public.company_members cm
JOIN auth.users au ON au.id = cm.user_id
JOIN public.companies c ON c.id = cm.company_id
WHERE cm.company_id = '6998295e-89ae-4e3d-afd2-8c2b0333eac2';

-- Expected: office@pashkovsky-group.com → Pashkovsky Group → owner

