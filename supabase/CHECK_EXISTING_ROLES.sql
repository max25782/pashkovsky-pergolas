-- ==========================================
-- Step 1: Check existing roles in platform_admins
-- ==========================================

SELECT 
  role,
  COUNT(*) as count,
  array_agg(user_id) as user_ids
FROM public.platform_admins
GROUP BY role;

-- Check all records
SELECT * FROM public.platform_admins;

