-- ==========================================
-- ALL-IN-ONE: Fix Phone Login
-- ==========================================
-- Copy this ENTIRE script and run in Supabase SQL Editor
-- This will fix phone login completely

-- Step 1: Add columns
ALTER TABLE public.platform_admins
ADD COLUMN IF NOT EXISTS phone VARCHAR(20) UNIQUE;

ALTER TABLE public.platform_admins
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Step 2: Add indexes
CREATE INDEX IF NOT EXISTS idx_platform_admins_phone ON public.platform_admins(phone);
CREATE INDEX IF NOT EXISTS idx_platform_admins_email ON public.platform_admins(email);

-- Step 3: Update your SuperAdmin with phone and email
UPDATE public.platform_admins pa
SET 
  phone = '0524494848',
  email = COALESCE(pa.email, u.email)
FROM auth.users u
WHERE pa.user_id = u.id
  AND pa.user_id = '41bc1d19-aa1f-4427-b739-98003bea8528';

-- Step 4: Create function for phone check
CREATE OR REPLACE FUNCTION public.check_superadmin_phone(phone_number TEXT)
RETURNS TABLE(email TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT pa.email::TEXT
  FROM public.platform_admins pa
  WHERE pa.phone = phone_number
    AND pa.is_active = true
  LIMIT 1;
END;
$$;

-- Step 5: Grant permissions
GRANT EXECUTE ON FUNCTION public.check_superadmin_phone(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_superadmin_phone(TEXT) TO anon;

-- Step 6: Verify everything
SELECT 
  pa.user_id,
  pa.email,
  pa.phone,
  pa.role,
  pa.is_active
FROM public.platform_admins pa
WHERE pa.phone = '0524494848';

-- Step 7: Test function
SELECT * FROM public.check_superadmin_phone('0524494848');

-- Expected output from Step 7:
-- | email |
-- | office@pashkovsky-group.com |

-- ✅ Done! Phone login should work now!

