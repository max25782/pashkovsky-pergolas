-- Migration 013: Add Roles and Permissions System
-- Purpose: Enable multi-user companies with role-based access control

-- ============================================
-- 1. CREATE ROLES ENUM
-- ============================================
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'worker', 'viewer');

-- ============================================
-- 2. ADD ROLE TO COMPANY_MEMBERS
-- ============================================
ALTER TABLE company_members
ADD COLUMN role user_role NOT NULL DEFAULT 'viewer',
ADD COLUMN invited_by uuid REFERENCES auth.users(id),
ADD COLUMN invited_at timestamptz DEFAULT now(),
ADD COLUMN accepted_at timestamptz;

-- ============================================
-- 3. CREATE PERMISSIONS TABLE (optional, for fine-grained control)
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
('admin', 'settings', 'update');

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
('manager', 'settings', 'read');

-- Worker: Limited to work logs
INSERT INTO role_permissions (role, resource, action) VALUES
('worker', 'workers', 'create'), -- can create own shifts
('worker', 'workers', 'read'),   -- can read own shifts
('worker', 'deals', 'read');      -- can view assigned projects

-- Viewer: Read-only
INSERT INTO role_permissions (role, resource, action) VALUES
('viewer', 'deals', 'read'),
('viewer', 'offers', 'read'),
('viewer', 'workers', 'read');

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
  SELECT role INTO v_user_role
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
CREATE INDEX idx_company_members_user_company 
  ON company_members(user_id, company_id);

CREATE INDEX idx_company_members_role 
  ON company_members(role);

CREATE INDEX idx_role_permissions_lookup 
  ON role_permissions(role, resource, action);

-- ============================================
-- 7. ADD COMMENTS
-- ============================================
COMMENT ON TYPE user_role IS 'User roles: admin (full access), manager (deals/offers), worker (shifts only), viewer (read-only)';
COMMENT ON COLUMN company_members.role IS 'User role in this company';
COMMENT ON FUNCTION has_permission IS 'Check if user has permission for resource+action in company';

