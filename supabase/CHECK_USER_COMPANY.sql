-- Check if the current logged-in user is in company_members table

-- 1. Check current users
SELECT 
  id,
  email,
  created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- 2. Check company_members for these users
SELECT 
  cm.id,
  cm.user_id,
  cm.company_id,
  cm.role,
  au.email,
  c.name as company_name
FROM company_members cm
JOIN auth.users au ON cm.user_id = au.id
LEFT JOIN companies c ON cm.company_id = c.id
ORDER BY cm.created_at DESC
LIMIT 10;

-- 3. Find users NOT in company_members
SELECT 
  au.id,
  au.email,
  au.created_at,
  'NOT IN COMPANY_MEMBERS' as status
FROM auth.users au
LEFT JOIN company_members cm ON au.id = cm.user_id
WHERE cm.id IS NULL
ORDER BY au.created_at DESC;

-- 4. Check companies
SELECT 
  id,
  name,
  created_at
FROM companies
ORDER BY created_at DESC
LIMIT 5;

