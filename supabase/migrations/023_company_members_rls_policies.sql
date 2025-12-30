-- ==========================================
-- RLS Policies for company_members table
-- ==========================================
-- This migration creates proper RLS policies for multi-tenancy
-- Users can only access their own company_members records

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own company membership" ON public.company_members;
DROP POLICY IF EXISTS "Users can update their own company membership" ON public.company_members;
DROP POLICY IF EXISTS "Service role can manage all company members" ON public.company_members;

-- Enable RLS on company_members (if not already enabled)
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can SELECT their own company_members record
CREATE POLICY "Users can view their own company membership"
ON public.company_members
FOR SELECT
TO authenticated
USING (
    auth.uid() = user_id
);

-- Policy 2: Users can UPDATE their own company_members record
CREATE POLICY "Users can update their own company membership"
ON public.company_members
FOR UPDATE
TO authenticated
USING (
    auth.uid() = user_id
)
WITH CHECK (
    auth.uid() = user_id
);

-- Policy 3: Service role (backend) can manage all company_members
CREATE POLICY "Service role can manage all company members"
ON public.company_members
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Grant necessary permissions
GRANT SELECT, UPDATE ON public.company_members TO authenticated;
GRANT ALL ON public.company_members TO service_role;

-- Verify policies were created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename = 'company_members'
ORDER BY policyname;

