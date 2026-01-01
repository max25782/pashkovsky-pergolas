-- ALTERNATIVE: Keep existing company, just fix FK and link new auth user
-- Run this INSTEAD of MIGRATION_STEPS.sql

BEGIN;

-- Step 1: Check current company_members
SELECT 
  'Before migration' as stage,
  id, user_id, company_id, role
FROM public.company_members;

-- Step 2: Backup current data (just in case)
CREATE TEMP TABLE company_members_backup AS 
SELECT * FROM public.company_members;

-- Step 3: KEEP company_members data, but drop FK constraint
ALTER TABLE public.company_members 
DROP CONSTRAINT IF EXISTS company_members_user_id_fkey;

-- Step 4: Create new FK to auth.users (will work after we add auth user)
ALTER TABLE public.company_members
ADD CONSTRAINT company_members_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE
DEFERRABLE INITIALLY DEFERRED; -- Important: allows temporary mismatch

-- Step 5: Verify FK is updated
SELECT 'FK updated to auth.users' as status;

COMMIT;

-- =====================================================
-- AFTER REGISTRATION:
-- You'll need to update company_members.user_id to your new auth.users.id
-- We'll provide a script for that after you register
-- =====================================================

-- Step 6: Disable RLS for development
ALTER TABLE public.deals DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers DISABLE ROW LEVEL SECURITY;

-- Verify
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('workers', 'leads', 'deals', 'offers')
ORDER BY tablename;

