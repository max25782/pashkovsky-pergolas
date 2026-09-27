-- ============================================
-- Phase 3: Billing & Features
-- Create plans table with feature flags
-- ============================================

CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL, -- 'trial', 'basic', 'pro', 'enterprise'
  name TEXT NOT NULL,
  name_he TEXT,
  name_ru TEXT,
  description TEXT,
  description_he TEXT,
  description_ru TEXT,
  
  -- Pricing
  price_monthly DECIMAL(10,2),
  price_yearly DECIMAL(10,2),
  currency TEXT DEFAULT 'ILS',
  
  -- Limits
  max_users INT,
  max_deals INT,
  max_storage_gb INT,
  
  -- Features (JSON для гибкости)
  features JSONB DEFAULT '{}'::jsonb,
  /*
  Example features structure:
  {
    "ai": true|false,
    "teams": true|false,
    "signatures": true|false,
    "custom_reports": true|false,
    "white_label": true|false,
    "api_access": true|false,
    "priority_support": true|false
  }
  */
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_visible BOOLEAN DEFAULT true, -- Show on pricing page
  sort_order INT DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_plans_slug ON plans(slug);
CREATE INDEX IF NOT EXISTS idx_plans_active ON plans(is_active);
CREATE INDEX IF NOT EXISTS idx_plans_sort_order ON plans(sort_order);

-- Insert default plans
INSERT INTO plans (
  slug, name, name_he, name_ru,
  price_monthly, price_yearly,
  max_users, max_deals, max_storage_gb,
  features,
  is_active, is_visible, sort_order
) VALUES
-- Trial Plan (14 days free)
(
  'trial',
  'Trial',
  'תקופת נסיון',
  'Пробный период',
  0, 0,
  2, 10, 1,
  '{"ai": false, "teams": false, "signatures": true, "custom_reports": false, "white_label": false, "api_access": false, "priority_support": false}'::jsonb,
  true, false, 0
),

-- Basic Plan
(
  'basic',
  'Basic',
  'בסיסי',
  'Базовый',
  99, 990, -- ₪99/month or ₪990/year (2 months free)
  5, 50, 5,
  '{"ai": false, "teams": true, "signatures": true, "custom_reports": false, "white_label": false, "api_access": false, "priority_support": false}"::jsonb,
  true, true, 1
),

-- Pro Plan (Recommended)
(
  'pro',
  'Pro',
  'מקצועי',
  'Профессиональный',
  299, 2990, -- ₪299/month or ₪2990/year
  15, 200, 20,
  '{"ai": true, "teams": true, "signatures": true, "custom_reports": true, "white_label": false, "api_access": true, "priority_support": true}'::jsonb,
  true, true, 2
),

-- Enterprise Plan
(
  'enterprise',
  'Enterprise',
  'ארגוני',
  'Корпоративный',
  NULL, NULL, -- Custom pricing
  NULL, NULL, NULL, -- Unlimited
  '{"ai": true, "teams": true, "signatures": true, "custom_reports": true, "white_label": true, "api_access": true, "priority_support": true}'::jsonb,
  true, true, 3
)
ON CONFLICT (slug) DO NOTHING;

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_plans_updated_at ON plans;
CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW
  EXECUTE FUNCTION update_plans_updated_at();

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Plans table created successfully';
  RAISE NOTICE '✅ Default plans: Trial, Basic, Pro, Enterprise';
END $$;



