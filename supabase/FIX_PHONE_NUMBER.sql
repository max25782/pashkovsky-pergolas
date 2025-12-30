-- Update phone number to match what user is entering
UPDATE public.platform_admins
SET phone = '0524494848'  -- Double 4 (as user is entering)
WHERE user_id = '41bc1d19-aa1f-4427-b739-98003bea8528';

-- Verify
SELECT 
  user_id,
  email,
  phone,
  role,
  is_active,
  '✓ Phone updated to 0524494848' as status
FROM public.platform_admins
WHERE user_id = '41bc1d19-aa1f-4427-b739-98003bea8528';

