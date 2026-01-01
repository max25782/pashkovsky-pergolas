-- ==========================================
-- Fix SuperAdmin: Update existing record + Add constraint
-- ==========================================

-- Step 1: Drop old constraint (if exists)
ALTER TABLE public.platform_admins 
DROP CONSTRAINT IF EXISTS platform_admins_role_check;

-- Step 2: Update existing record to lowercase and add phone/email
UPDATE public.platform_admins
SET 
  role = 'superadmin',  -- lowercase
  phone = '0524484848',
  email = 'office@pashkovsky-group.com',
  is_active = true,
  permissions = '{"all": true}'::jsonb
WHERE user_id = '41bc1d19-aa1f-4427-b739-98003bea8528';

-- Step 3: Add new constraint (lowercase values)
ALTER TABLE public.platform_admins 
ADD CONSTRAINT platform_admins_role_check 
CHECK (role IN ('superadmin', 'admin', 'support'));

-- Step 4: Verify the result
SELECT 
  user_id,
  role,
  phone,
  email,
  is_active,
  permissions,
  '✓ SuperAdmin ready for token login!' as status
FROM public.platform_admins 
WHERE user_id = '41bc1d19-aa1f-4427-b739-98003bea8528';

