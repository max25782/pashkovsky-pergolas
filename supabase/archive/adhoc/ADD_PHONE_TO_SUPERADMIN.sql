-- ==========================================
-- Add Phone Number to Platform Admins
-- ==========================================
-- This allows SuperAdmin to login with phone number

-- 1. Add phone column to platform_admins
ALTER TABLE public.platform_admins
ADD COLUMN IF NOT EXISTS phone VARCHAR(20) UNIQUE;

-- 2. Add index for phone lookups
CREATE INDEX IF NOT EXISTS idx_platform_admins_phone 
ON public.platform_admins(phone);

-- 3. Add comment
COMMENT ON COLUMN public.platform_admins.phone IS 'Phone number for SuperAdmin login (optional, alternative to email)';

-- 4. Update your SuperAdmin record with phone number
-- Replace with your actual user_id from platform_admins
UPDATE public.platform_admins
SET phone = '0524494848'
WHERE user_id = '41bc1d19-aa1f-4427-b739-98003bea8528';

-- 5. Verify the update
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
-- | 41bc1d19... | office@pashkovsky-group.com | 0524494848 | SUPERADMIN | true |

-- ✅ Done! Phone number added to your SuperAdmin account

