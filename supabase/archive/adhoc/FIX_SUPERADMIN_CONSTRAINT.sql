-- ==========================================
-- Fix platform_admins role constraint
-- ==========================================

-- Step 1: Drop old constraint if exists
ALTER TABLE public.platform_admins 
DROP CONSTRAINT IF EXISTS platform_admins_role_check;

-- Step 2: Add new constraint with 'superadmin', 'admin', 'support'
ALTER TABLE public.platform_admins 
ADD CONSTRAINT platform_admins_role_check 
CHECK (role IN ('superadmin', 'admin', 'support'));

-- Step 3: Now insert/update SuperAdmin
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

-- Step 4: Verify
SELECT 
  phone,
  email,
  role,
  is_active,
  '✓ SuperAdmin ready!' as status
FROM public.platform_admins 
WHERE phone = '0524484848';

