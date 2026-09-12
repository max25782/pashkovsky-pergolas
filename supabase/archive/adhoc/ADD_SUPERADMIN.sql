-- ==========================================
-- Add Platform SuperAdmin
-- ==========================================
-- Run this AFTER migration 024

-- 1. Find your user_id (should output your auth.users.id)
SELECT 
  id as user_id, 
  email,
  created_at
FROM auth.users 
WHERE email = 'office@pashkovsky-group.com';

-- Expected output: 41bc1d19-aa1f-4427-b739-98003bea8528

-- 2. Insert as SUPERADMIN (replace user_id if different)
INSERT INTO public.platform_admins (user_id, role, permissions)
VALUES (
  '41bc1d19-aa1f-4427-b739-98003bea8528', 
  'SUPERADMIN',
  '{
    "manage_all_companies": true,
    "view_analytics": true,
    "manage_plans": true,
    "manage_billing": true,
    "view_all_data": true,
    "manage_users": true
  }'::jsonb
)
ON CONFLICT (user_id) 
DO UPDATE SET 
  role = 'SUPERADMIN',
  is_active = true,
  permissions = EXCLUDED.permissions,
  updated_at = now();

-- 3. Verify
SELECT 
  pa.id,
  pa.role,
  u.email,
  pa.permissions,
  pa.is_active,
  pa.created_at
FROM public.platform_admins pa
JOIN auth.users u ON u.id = pa.user_id
WHERE pa.user_id = '41bc1d19-aa1f-4427-b739-98003bea8528';

-- Should see:
-- | id | role | email | permissions | is_active | created_at |
-- | ... | SUPERADMIN | office@pashkovsky-group.com | {...} | true | ... |

-- ✅ Done! You are now a SUPERADMIN

