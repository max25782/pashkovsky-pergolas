-- Check which companies user oryaron38@gmail.com belongs to
-- This will help debug why it redirects to Pashkovsky Group

SELECT 
  u.id as user_id,
  u.email,
  cm.company_id,
  c.name as company_name,
  cm.role,
  c.created_at as company_created_at,
  cm.created_at as membership_created_at
FROM auth.users u
JOIN company_members cm ON cm.user_id = u.id
JOIN companies c ON c.id = cm.company_id
WHERE u.email = 'oryaron38@gmail.com'
ORDER BY c.created_at DESC;

-- Also check if user belongs to Pashkovsky Group
SELECT 
  c.name as company_name,
  cm.role,
  cm.created_at
FROM company_members cm
JOIN companies c ON c.id = cm.company_id
WHERE cm.user_id = (SELECT id FROM auth.users WHERE email = 'oryaron38@gmail.com')
  AND c.name LIKE '%Pashkovsky%'
ORDER BY cm.created_at DESC;




