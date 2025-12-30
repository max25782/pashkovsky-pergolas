-- TEMPORARY: Disable RLS for development
-- Run this NOW so you can continue working
-- After Google OAuth is configured, we'll enable RLS properly

ALTER TABLE public.deals DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('workers', 'leads', 'deals', 'offers')
ORDER BY tablename;

-- Should show 'false' for all tables

