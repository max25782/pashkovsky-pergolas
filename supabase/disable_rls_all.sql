-- DISABLE RLS for development
-- WARNING: This removes row-level security. Only use in development!
-- WARNING: NEVER run this in production. Use 019_enable_rls_with_policies.sql or 020_enable_rls_simple.sql to re-enable.

ALTER TABLE public.deals DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('workers', 'leads', 'deals', 'offers')
ORDER BY tablename;

