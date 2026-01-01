-- Check if articles table exists in Supabase

-- 1. Check if table exists
SELECT 
  table_name, 
  table_type
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name = 'articles';

-- 2. If exists, show structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'articles'
ORDER BY ordinal_position;

-- 3. Show existing articles
SELECT * FROM public.articles LIMIT 5;

