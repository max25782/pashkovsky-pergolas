-- ==========================================
-- Fix Phone Login: Add Email to platform_admins
-- ==========================================
-- This allows phone login without complex auth.users joins

-- 1. Add email column to platform_admins
ALTER TABLE public.platform_admins
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- 2. Populate email from auth.users
UPDATE public.platform_admins pa
SET email = u.email
FROM auth.users u
WHERE pa.user_id = u.id
  AND pa.email IS NULL;

-- 3. Verify the update
SELECT 
  pa.user_id,
  pa.email,
  pa.phone,
  pa.role,
  pa.is_active
FROM public.platform_admins pa
WHERE pa.phone = '0524494848';

-- Expected output:
-- | user_id | email | phone | role | is_active |
-- | 41bc1d19... | office@pashkovsky-group.com | 0524494848 | SUPERADMIN | true |

-- ✅ Now phone login will work!

