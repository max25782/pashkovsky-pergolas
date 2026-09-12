-- ==========================================
-- QUICK FIX: Add Phone to SuperAdmin
-- ==========================================
-- Copy and run this in Supabase SQL Editor

-- 1. Add phone column (if not exists)
ALTER TABLE public.platform_admins
ADD COLUMN IF NOT EXISTS phone VARCHAR(20) UNIQUE;

-- 2. Add index
CREATE INDEX IF NOT EXISTS idx_platform_admins_phone 
ON public.platform_admins(phone);

-- 3. Update YOUR SuperAdmin record with phone
UPDATE public.platform_admins
SET phone = '0524494848'
WHERE user_id = '41bc1d19-aa1f-4427-b739-98003bea8528';

-- 4. Verify it worked
SELECT 
  pa.user_id,
  u.email,
  pa.phone,
  pa.role,
  pa.is_active
FROM public.platform_admins pa
JOIN auth.users u ON u.id = pa.user_id
WHERE pa.phone = '0524494848';

-- Expected output:
-- | user_id | email | phone | role | is_active |
-- | 41bc1d19-aa1f-4427-b739-98003bea8528 | office@pashkovsky-group.com | 0524494848 | SUPERADMIN | true |

-- ✅ If you see the row above, phone login will work!
-- ❌ If you see 0 rows, check your user_id or run the migration again

