-- ==========================================
-- Check and Fix Phone → Email Link
-- ==========================================

-- Step 1: Check if phone exists in platform_admins
SELECT 
  pa.user_id,
  pa.email,
  pa.phone,
  pa.role,
  pa.is_active,
  CASE 
    WHEN pa.email = 'office@pashkovsky-group.com' THEN '✓ Email correct'
    ELSE '✗ Email wrong: ' || pa.email
  END as status
FROM public.platform_admins pa
WHERE pa.phone = '0524484848';

-- Step 2: If phone doesn't exist or email is wrong, fix it:
INSERT INTO public.platform_admins (
  user_id,
  role,
  permissions,
  is_active,
  phone,
  email
)
VALUES (
  '41bc1d19-aa1f-4427-b739-98003bea8528',
  'superadmin',
  '{"all": true}'::jsonb,
  true,
  '0524484848',
  'office@pashkovsky-group.com'
)
ON CONFLICT (user_id) 
DO UPDATE SET
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  is_active = true,
  role = 'superadmin',
  permissions = '{"all": true}'::jsonb;

-- Step 3: Verify
SELECT 
  pa.phone,
  pa.email,
  pa.role,
  pa.is_active,
  '✓ Ready for login!' as status
FROM public.platform_admins pa
WHERE pa.phone = '0524484848';

