-- Check workers in database
-- 1. Count all workers
SELECT 
  'Total workers' as check_name,
  COUNT(*) as count
FROM workers;

-- 2. Workers by company
SELECT 
  'Workers by company' as check_name,
  company_id,
  COUNT(*) as count
FROM workers
GROUP BY company_id;

-- 3. All workers details
SELECT 
  id,
  company_id,
  first_name,
  last_name,
  phone,
  daily_rate,
  is_active,
  created_at
FROM workers
ORDER BY created_at DESC;

