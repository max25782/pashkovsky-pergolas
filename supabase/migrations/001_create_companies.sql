-- ============================================
-- Phase 1: Multi-Tenant Foundation
-- Create companies table
-- ============================================

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL, -- для URL: company.crm.com
  status TEXT DEFAULT 'active' CHECK (status IN ('trial', 'active', 'suspended', 'cancelled')),
  plan TEXT DEFAULT 'trial',
  industry TEXT, -- 'pergola', 'aluminum', 'general'
  
  -- Contact
  primary_email TEXT,
  primary_phone TEXT,
  address TEXT,
  
  -- Settings
  settings JSONB DEFAULT '{}'::jsonb, -- theme, locale, timezone
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  trial_ends_at TIMESTAMPTZ,
  subscription_ends_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);
CREATE INDEX IF NOT EXISTS idx_companies_created_at ON companies(created_at DESC);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_companies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_companies_updated_at();

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Companies table created successfully';
END $$;

