-- Check if public.users table exists and has data
SELECT 
  COUNT(*) as user_count,
  MIN(created_at) as first_user,
  MAX(created_at) as last_user
FROM public.users;

-- Check all users
SELECT id, email, full_name, created_at, email_verified_at
FROM public.users
ORDER BY created_at DESC;

-- Check if any company_members reference these users
SELECT 
  cm.id,
  cm.user_id,
  cm.company_id,
  cm.role,
  u.email,
  u.full_name
FROM public.company_members cm
LEFT JOIN public.users u ON u.id = cm.user_id
ORDER BY cm.created_at DESC;

