-- Migration 000: Create Base Multi-Tenant Structure
-- Run this FIRST if companies and company_members don't exist

-- ============================================
-- 1. CREATE COMPANIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 2. CREATE COMPANY_MEMBERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS company_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, company_id)
);

-- ============================================
-- 3. ADD INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_company_members_user 
  ON company_members(user_id);

CREATE INDEX IF NOT EXISTS idx_company_members_company 
  ON company_members(company_id);

-- ============================================
-- 4. ADD COMPANY_ID TO EXISTING TABLES
-- ============================================

-- Add to deals if exists
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'deals') THEN
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'deals' AND column_name = 'company_id'
    ) THEN
      ALTER TABLE deals ADD COLUMN company_id uuid REFERENCES companies(id);
    END IF;
  END IF;
END $$;

-- Add to offers if exists
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'offers') THEN
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'offers' AND column_name = 'company_id'
    ) THEN
      ALTER TABLE offers ADD COLUMN company_id uuid REFERENCES companies(id);
    END IF;
  END IF;
END $$;

-- ============================================
-- 5. CREATE DEFAULT COMPANY FOR EXISTING DATA
-- ============================================
DO $$
DECLARE
  v_company_id uuid;
BEGIN
  -- Check if any companies exist
  IF NOT EXISTS (SELECT 1 FROM companies LIMIT 1) THEN
    -- Create default company
    INSERT INTO companies (name) 
    VALUES ('Pashkovsky Group') 
    RETURNING id INTO v_company_id;
    
    -- Update existing deals
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'deals') THEN
      UPDATE deals SET company_id = v_company_id WHERE company_id IS NULL;
    END IF;
    
    -- Update existing offers
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'offers') THEN
      UPDATE offers SET company_id = v_company_id WHERE company_id IS NULL;
    END IF;
  END IF;
END $$;

COMMENT ON TABLE companies IS 'Companies/Organizations in the multi-tenant system';
COMMENT ON TABLE company_members IS 'Users belonging to companies with their roles';

