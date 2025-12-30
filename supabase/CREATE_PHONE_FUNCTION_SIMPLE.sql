-- ==========================================
-- SIMPLE VERSION: Create Phone Check Function
-- ==========================================
-- Copy this ENTIRE block and run in Supabase SQL Editor

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

GRANT EXECUTE ON FUNCTION public.check_superadmin_phone(TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.check_superadmin_phone(TEXT) TO anon;

-- Test
SELECT * FROM public.check_superadmin_phone('0524494848');

