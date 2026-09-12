-- Check what phone number is in platform_admins
SELECT 
  user_id,
  email,
  phone,
  role,
  is_active,
  CASE 
    WHEN phone = '0524484848' THEN '✓ Has 0524484848'
    WHEN phone = '0524494848' THEN '✓ Has 0524494848 (with double 4)'
    ELSE '✗ Different phone: ' || phone
  END as phone_status
FROM public.platform_admins
WHERE user_id = '41bc1d19-aa1f-4427-b739-98003bea8528';

-- If phone is wrong or missing, fix it:
-- UPDATE public.platform_admins
-- SET phone = '0524494848'
-- WHERE user_id = '41bc1d19-aa1f-4427-b739-98003bea8528';

