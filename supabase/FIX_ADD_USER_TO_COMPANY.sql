-- Add current user to company_members table
-- This fixes the "User not in any company" error for AI features

-- STEP 1: Get your user ID
-- Replace 'your-email@example.com' with your actual email
DO $$
DECLARE
  v_user_id uuid;
  v_company_id uuid;
BEGIN
  -- Find user by email (UPDATE THIS!)
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'office@pashkovsky-group.com'  -- ⚠️ CHANGE THIS TO YOUR EMAIL
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found! Please update the email in the script.';
  END IF;

  -- Find or create default company
  SELECT id INTO v_company_id
  FROM companies
  WHERE name = 'Pashkovsky Group'
  LIMIT 1;

  -- If no company exists, create one
  IF v_company_id IS NULL THEN
    INSERT INTO companies (name, settings)
    VALUES ('Pashkovsky Group', '{}')
    RETURNING id INTO v_company_id;
    
    RAISE NOTICE 'Created new company: %', v_company_id;
  END IF;

  -- Check if user is already in company_members
  IF EXISTS (SELECT 1 FROM company_members WHERE user_id = v_user_id) THEN
    RAISE NOTICE 'User already in company_members';
  ELSE
    -- Add user to company with 'owner' role
    INSERT INTO company_members (user_id, company_id, role)
    VALUES (v_user_id, v_company_id, 'owner');
    
    RAISE NOTICE 'Added user to company_members with role: owner';
  END IF;

  -- Display result
  RAISE NOTICE '✓ Done! User: %, Company: %', v_user_id, v_company_id;
END $$;

-- Verify the fix
SELECT 
  cm.id,
  au.email,
  c.name as company_name,
  cm.role
FROM company_members cm
JOIN auth.users au ON cm.user_id = au.id
JOIN companies c ON cm.company_id = c.id
WHERE au.email = 'office@pashkovsky-group.com'  -- ⚠️ CHANGE THIS TO YOUR EMAIL
LIMIT 1;

