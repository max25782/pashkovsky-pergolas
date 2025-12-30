-- ==========================================
-- COMPLETE FIX: Add Phone + Email to SuperAdmin
-- ==========================================
-- Run this ENTIRE script in Supabase SQL Editor

-- Step 1: Add columns if they don't exist
ALTER TABLE public.platform_admins
ADD COLUMN IF NOT EXISTS phone VARCHAR(20) UNIQUE;

ALTER TABLE public.platform_admins
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Step 2: Add indexes
CREATE INDEX IF NOT EXISTS idx_platform_admins_phone 
ON public.platform_admins(phone);

CREATE INDEX IF NOT EXISTS idx_platform_admins_email 
ON public.platform_admins(email);

-- Step 3: Check current state
SELECT 
  pa.id,
  pa.user_id,
  pa.email,
  pa.phone,
  pa.role,
  pa.is_active,
  u.email as auth_email
FROM public.platform_admins pa
LEFT JOIN auth.users u ON u.id = pa.user_id
WHERE pa.user_id = '41bc1d19-aa1f-4427-b739-98003bea8528';

-- Step 4: Update with phone AND email
UPDATE public.platform_admins pa
SET 
  phone = '0524494848',
  email = COALESCE(pa.email, u.email)
FROM auth.users u
WHERE pa.user_id = u.id
  AND pa.user_id = '41bc1d19-aa1f-4427-b739-98003bea8528';

-- Step 5: Verify the update
SELECT 
  pa.user_id,
  pa.email,
  pa.phone,
  pa.role,
  pa.is_active,
  u.email as auth_email_match
FROM public.platform_admins pa
JOIN auth.users u ON u.id = pa.user_id
WHERE pa.phone = '0524494848'
   OR pa.user_id = '41bc1d19-aa1f-4427-b739-98003bea8528';

-- Expected output:
-- | user_id | email | phone | role | is_active | auth_email_match |
-- | 41bc1d19... | office@pashkovsky-group.com | 0524494848 | SUPERADMIN | true | office@pashkovsky-group.com |

-- ✅ If you see the row above, phone login will work!

-- Step 6: Double-check by phone lookup
SELECT * FROM public.platform_admins 
WHERE phone = '0524494848' 
  AND is_active = true;

-- Should return 1 row with all fields populated

