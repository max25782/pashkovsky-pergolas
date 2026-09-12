-- ==========================================
-- Create Function: Check SuperAdmin Phone
-- ==========================================
-- This function allows anonymous users to check if phone is registered
-- Returns email if found, NULL if not

CREATE OR REPLACE FUNCTION public.check_superadmin_phone(phone_number TEXT)
RETURNS TABLE(email TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER -- Run with creator's privileges (bypasses RLS)
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

-- Grant execute to authenticated and anon
GRANT EXECUTE ON FUNCTION public.check_superadmin_phone(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_superadmin_phone(TEXT) TO anon;

-- Test the function
SELECT * FROM public.check_superadmin_phone('0524494848');

-- Expected output:
-- | email |
-- | office@pashkovsky-group.com |

-- ✅ Function created! Now phone login will work via RPC call

