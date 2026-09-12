-- Migration 013 (MODIFIED): Add Roles and Permissions System
-- Purpose: Enable multi-user companies with role-based access control
-- MODIFIED: Works with existing role column

-- ============================================
-- 1. CREATE ROLES ENUM
-- ============================================
DO $$ 
BEGIN
  -- Drop the type if it exists (in case of re-run)
  DROP TYPE IF EXISTS user_role CASCADE;
  
  -- Create the enum type
  CREATE TYPE user_role AS ENUM ('admin', 'manager', 'worker', 'viewer');
END $$;

-- ============================================
-- 2. MIGRATE EXISTING ROLE COLUMN
-- ============================================
-- IMPORTANT: Update values BEFORE changing column type

-- Step 1: Check current column type and update accordingly
DO $$
DECLARE
  v_column_type text;
  v_constraint_name text;
BEGIN
  -- Get current column type
  SELECT data_type INTO v_column_type
  FROM information_schema.columns
  WHERE table_name = 'company_members' AND column_name = 'role';
  
  -- If column is still text, update values
  IF v_column_type = 'text' OR v_column_type = 'character varying' THEN
    RAISE NOTICE 'Converting role column from % to user_role', v_column_type;
    
    -- Convert existing 'owner' role to 'admin'
    UPDATE company_members 
    SET role = 'admin' 
    WHERE role = 'owner';
    
    -- Convert any other text values to 'admin' as well
    UPDATE company_members 
    SET role = 'admin' 
    WHERE role NOT IN ('admin', 'manager', 'worker', 'viewer');
    
    -- Drop any check constraints on role column
    FOR v_constraint_name IN 
      SELECT constraint_name 
      FROM information_schema.constraint_column_usage 
      WHERE table_name = 'company_members' AND column_name = 'role'
    LOOP
      EXECUTE format('ALTER TABLE company_members DROP CONSTRAINT IF EXISTS %I', v_constraint_name);
      RAISE NOTICE 'Dropped constraint: %', v_constraint_name;
    END LOOP;
    
    -- Remove the default before changing type
    ALTER TABLE company_members ALTER COLUMN role DROP DEFAULT;
    
    -- Change the column type from text to user_role enum
    -- Use a simple cast without checking existing constraints
    EXECUTE 'ALTER TABLE company_members ALTER COLUMN role TYPE user_role USING role::text::user_role';
    
    -- Set new default with correct type
    ALTER TABLE company_members 
    ALTER COLUMN role SET DEFAULT 'viewer'::user_role;
    
    -- Make sure column is NOT NULL
    ALTER TABLE company_members 
    ALTER COLUMN role SET NOT NULL;
    
    RAISE NOTICE 'Column type changed from % to user_role', v_column_type;
  ELSE
    RAISE NOTICE 'Column role is already user_role type, skipping type conversion';
  END IF;
END $$;

-- Add new columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns 
                 WHERE table_name = 'company_members' AND column_name = 'invited_by') THEN
    ALTER TABLE company_members ADD COLUMN invited_by uuid REFERENCES auth.users(id);
  END IF;
  
  IF NOT EXISTS (SELECT FROM information_schema.columns 
                 WHERE table_name = 'company_members' AND column_name = 'invited_at') THEN
    ALTER TABLE company_members ADD COLUMN invited_at timestamptz DEFAULT now();
  END IF;
  
  IF NOT EXISTS (SELECT FROM information_schema.columns 
                 WHERE table_name = 'company_members' AND column_name = 'accepted_at') THEN
    ALTER TABLE company_members ADD COLUMN accepted_at timestamptz;
  END IF;
END $$;

-- ============================================
-- 3. CREATE PERMISSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role user_role NOT NULL,
  resource text NOT NULL, -- 'deals', 'offers', 'workers', 'settings', etc.
  action text NOT NULL,   -- 'create', 'read', 'update', 'delete', 'invite'
  created_at timestamptz DEFAULT now(),
  UNIQUE(role, resource, action)
);

-- ============================================
-- 4. SEED DEFAULT PERMISSIONS
-- ============================================

-- Admin: Full access
INSERT INTO role_permissions (role, resource, action) VALUES
('admin', 'deals', 'create'),
('admin', 'deals', 'read'),
('admin', 'deals', 'update'),
('admin', 'deals', 'delete'),
('admin', 'offers', 'create'),
('admin', 'offers', 'read'),
('admin', 'offers', 'update'),
('admin', 'offers', 'delete'),
('admin', 'workers', 'create'),
('admin', 'workers', 'read'),
('admin', 'workers', 'update'),
('admin', 'workers', 'delete'),
('admin', 'users', 'invite'),
('admin', 'users', 'remove'),
('admin', 'settings', 'read'),
('admin', 'settings', 'update')
ON CONFLICT (role, resource, action) DO NOTHING;

-- Manager: Deals, Offers, Workers (no settings, no user management)
INSERT INTO role_permissions (role, resource, action) VALUES
('manager', 'deals', 'create'),
('manager', 'deals', 'read'),
('manager', 'deals', 'update'),
('manager', 'deals', 'delete'),
('manager', 'offers', 'create'),
('manager', 'offers', 'read'),
('manager', 'offers', 'update'),
('manager', 'offers', 'delete'),
('manager', 'workers', 'read'),
('manager', 'settings', 'read')
ON CONFLICT (role, resource, action) DO NOTHING;

-- Worker: Limited to work logs
INSERT INTO role_permissions (role, resource, action) VALUES
('worker', 'workers', 'create'), -- can create own shifts
('worker', 'workers', 'read'),   -- can read own shifts
('worker', 'deals', 'read')      -- can view assigned projects
ON CONFLICT (role, resource, action) DO NOTHING;

-- Viewer: Read-only
INSERT INTO role_permissions (role, resource, action) VALUES
('viewer', 'deals', 'read'),
('viewer', 'offers', 'read'),
('viewer', 'workers', 'read')
ON CONFLICT (role, resource, action) DO NOTHING;

-- ============================================
-- 5. CREATE HELPER FUNCTION: Check Permission
-- ============================================
CREATE OR REPLACE FUNCTION has_permission(
  p_user_id uuid,
  p_company_id uuid,
  p_resource text,
  p_action text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_role user_role;
  v_has_permission boolean;
BEGIN
  -- Get user's role in this company
  SELECT role::user_role INTO v_user_role
  FROM company_members
  WHERE user_id = p_user_id 
    AND company_id = p_company_id;
  
  -- If user is not a member, return false
  IF v_user_role IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if role has this permission
  SELECT EXISTS(
    SELECT 1 FROM role_permissions
    WHERE role = v_user_role
      AND resource = p_resource
      AND action = p_action
  ) INTO v_has_permission;
  
  RETURN v_has_permission;
END;
$$;

-- ============================================
-- 6. ADD INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_company_members_user_company 
  ON company_members(user_id, company_id);

CREATE INDEX IF NOT EXISTS idx_company_members_role 
  ON company_members(role);

CREATE INDEX IF NOT EXISTS idx_role_permissions_lookup 
  ON role_permissions(role, resource, action);

-- ============================================
-- 7. ADD COMMENTS
-- ============================================
COMMENT ON TYPE user_role IS 'User roles: admin (full access), manager (deals/offers), worker (shifts only), viewer (read-only)';
COMMENT ON COLUMN company_members.role IS 'User role in this company';
COMMENT ON FUNCTION has_permission IS 'Check if user has permission for resource+action in company';

