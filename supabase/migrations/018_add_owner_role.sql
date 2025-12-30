-- Add 'owner' role to user_role enum
-- This role is used for company owners who have full permissions

-- Step 1: Add 'owner' to the enum (must be in separate transaction)
DO $$ 
BEGIN
  -- Check if 'owner' already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'owner' 
    AND enumtypid = 'user_role'::regtype
  ) THEN
    ALTER TYPE user_role ADD VALUE 'owner';
  END IF;
END $$;

-- Step 2: Update company_members CHECK constraint to include 'owner'
-- (This runs after the enum value is committed)
ALTER TABLE company_members 
DROP CONSTRAINT IF EXISTS company_members_role_check;

ALTER TABLE company_members
ADD CONSTRAINT company_members_role_check 
CHECK (role IN ('owner', 'admin', 'manager', 'worker', 'viewer'));

-- Comment for documentation
COMMENT ON TYPE user_role IS 'User roles: owner (full access), admin (most access), manager (moderate access), worker (limited access), viewer (read-only)';

