-- Ensure phone and email are set in platform_admins
INSERT INTO public.platform_admins (
  user_id,
  role,
  permissions,
  is_active,
  phone,
  email
)
VALUES (
  '41bc1d19-aa1f-4427-b739-98003bea8528',
  'superadmin',
  '{"all": true}'::jsonb,
  true,
  '0524484848',
  'office@pashkovsky-group.com'
)
ON CONFLICT (user_id) 
DO UPDATE SET
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  is_active = true,
  role = 'superadmin',
  permissions = '{"all": true}'::jsonb;

-- Verify
SELECT phone, email, role FROM public.platform_admins WHERE phone = '0524484848';

