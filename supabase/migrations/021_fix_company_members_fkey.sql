-- Migration: Update company_members to reference auth.users instead of public.users
-- This is required for Supabase Auth + RLS to work correctly

BEGIN;

-- Step 1: Drop existing foreign key constraint
ALTER TABLE public.company_members 
DROP CONSTRAINT IF EXISTS company_members_user_id_fkey;

-- Step 2: Create new foreign key to auth.users
-- Note: auth.users.id is UUID, which should match your company_members.user_id type
ALTER TABLE public.company_members
ADD CONSTRAINT company_members_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- Step 3: Verify the change
SELECT
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.table_name = 'company_members'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'user_id';

COMMIT;

-- Expected result:
-- company_members_user_id_fkey | company_members | user_id | auth | users | id

