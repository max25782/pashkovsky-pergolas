-- TEMPORARY: Disable RLS for development
-- WARNING: NEVER run in production.
-- Run this NOW so you can continue working
-- After Google OAuth is configured, run 020_enable_rls_simple.sql to re-enable.

-- PRODUCTION SAFETY CHECK: Uncomment to add a guard
-- DO $$ BEGIN IF current_database() NOT LIKE '%dev%' AND current_database() NOT LIKE '%local%' THEN RAISE EXCEPTION 'Refusing to disable RLS outside a dev database'; END IF; END $$;

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

