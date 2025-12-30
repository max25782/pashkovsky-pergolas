-- ==========================================
-- Debug: Check Phone Login Data
-- ==========================================

-- Step 1: Check platform_admins data
SELECT 
  pa.user_id,
  pa.email as platform_email,
  pa.phone,
  pa.role,
  pa.is_active
FROM public.platform_admins pa
WHERE pa.phone = '0524484848';

-- Step 2: Check auth.users data
SELECT 
  u.id,
  u.email as auth_email,
  u.created_at
FROM auth.users u
WHERE u.id = '41bc1d19-aa1f-4427-b739-98003bea8528';

-- Step 3: Compare both
SELECT 
  pa.email as platform_email,
  u.email as auth_email,
  CASE 
    WHEN pa.email = u.email THEN '✓ Match'
    ELSE '✗ Mismatch'
  END as email_match
FROM public.platform_admins pa
JOIN auth.users u ON u.id = pa.user_id
WHERE pa.phone = '0524484848';

-- If emails don't match, fix it:
-- UPDATE public.platform_admins pa
-- SET email = u.email
-- FROM auth.users u
-- WHERE pa.user_id = u.id
--   AND pa.phone = '0524484848';

