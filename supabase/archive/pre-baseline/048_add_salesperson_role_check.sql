-- Step 2: Update CHECK constraint (runs after enum value is committed)

ALTER TABLE company_members DROP CONSTRAINT IF EXISTS company_members_role_check;

ALTER TABLE company_members
  ADD CONSTRAINT company_members_role_check
  CHECK (role IN ('owner', 'admin', 'manager', 'worker', 'viewer', 'salesperson'));

COMMENT ON TYPE user_role IS 'User roles: owner, admin, manager, worker, viewer, salesperson (leads + offers)';
