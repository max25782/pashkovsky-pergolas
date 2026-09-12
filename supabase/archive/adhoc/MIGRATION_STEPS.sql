-- Step-by-step migration script
-- Run these commands IN ORDER in Supabase SQL Editor

-- =====================================================
-- STEP 1: Fix company_members foreign key
-- =====================================================

BEGIN;

-- Delete all company_members (clean slate)
DELETE FROM public.company_members;

-- Drop old FK to public.users
ALTER TABLE public.company_members 
DROP CONSTRAINT IF EXISTS company_members_user_id_fkey;

-- Create new FK to auth.users
ALTER TABLE public.company_members
ADD CONSTRAINT company_members_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- Verify
SELECT 'FK updated to auth.users' as status;

COMMIT;

-- =====================================================
-- STEP 2: Disable RLS for development
-- =====================================================

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

-- Expected: all should show 'false'

-- =====================================================
-- DONE! Now you can:
-- 1. Go to http://localhost:3001/register
-- 2. Register with your email (this will create Supabase Auth user)
-- 3. Your company will be created and linked to auth.users
-- =====================================================

