-- Migration 015: Add Subscription Plans and Usage Tracking
-- Purpose: Enable SaaS billing with plan limits and usage tracking

-- ============================================
-- 1. CREATE PLANS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE, -- 'free', 'basic', 'pro'
  display_name text NOT NULL, -- 'Free', 'Basic', 'Pro'
  description text,
  
  -- Pricing
  price_monthly numeric NOT NULL DEFAULT 0,
  price_yearly numeric, -- Optional annual pricing
  currency text DEFAULT '₪',
  
  -- Limits
  max_users integer, -- NULL = unlimited
  max_deals_per_month integer, -- NULL = unlimited
  max_storage_mb integer, -- NULL = unlimited
  
  -- Features (JSON for flexibility)
  features jsonb DEFAULT '{
    "pdf_generation": false,
    "whatsapp_integration": false,
    "email_integration": false,
    "worker_logs": false,
    "ai_analytics": false,
    "lead_scoring": false,
    "automation": false,
    "api_access": false,
    "custom_branding": false,
    "priority_support": false
  }'::jsonb,
  
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 2. SEED DEFAULT PLANS
-- ============================================

-- Free Plan
INSERT INTO subscription_plans (
  name, display_name, description, 
  price_monthly, max_users, max_deals_per_month, max_storage_mb,
  features
) VALUES (
  'free',
  'Free',
  'Perfect for trying out the platform',
  0,
  1, -- 1 user
  30, -- 30 deals/month
  100, -- 100 MB storage
  '{
    "pdf_generation": false,
    "whatsapp_integration": false,
    "email_integration": false,
    "worker_logs": false,
    "ai_analytics": false,
    "lead_scoring": false,
    "automation": false,
    "api_access": false,
    "custom_branding": false,
    "priority_support": false
  }'::jsonb
);

-- Basic Plan (₪199-₪299)
INSERT INTO subscription_plans (
  name, display_name, description,
  price_monthly, max_users, max_deals_per_month, max_storage_mb,
  features
) VALUES (
  'basic',
  'Basic',
  'For small teams and growing businesses',
  249, -- ₪249/month
  3, -- up to 3 users
  500, -- 500 deals/month
  1000, -- 1 GB storage
  '{
    "pdf_generation": true,
    "whatsapp_integration": true,
    "email_integration": true,
    "worker_logs": true,
    "ai_analytics": false,
    "lead_scoring": false,
    "automation": false,
    "api_access": false,
    "custom_branding": false,
    "priority_support": false
  }'::jsonb
);

-- Pro Plan (₪499+)
INSERT INTO subscription_plans (
  name, display_name, description,
  price_monthly, max_users, max_deals_per_month, max_storage_mb,
  features
) VALUES (
  'pro',
  'Pro',
  'For established businesses with advanced needs',
  499, -- ₪499/month
  NULL, -- unlimited users
  NULL, -- unlimited deals
  10000, -- 10 GB storage
  '{
    "pdf_generation": true,
    "whatsapp_integration": true,
    "email_integration": true,
    "worker_logs": true,
    "ai_analytics": true,
    "lead_scoring": true,
    "automation": true,
    "api_access": true,
    "custom_branding": true,
    "priority_support": true
  }'::jsonb
);

-- ============================================
-- 3. CREATE SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS company_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES subscription_plans(id),
  
  -- Subscription Status
  status text NOT NULL DEFAULT 'active', -- 'active', 'cancelled', 'expired', 'trial'
  trial_ends_at timestamptz,
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL,
  cancel_at_period_end boolean DEFAULT false,
  
  -- Payment Info (optional, for manual billing)
  payment_method text, -- 'manual', 'stripe', 'tranzila', etc.
  external_subscription_id text, -- ID from payment provider
  last_payment_at timestamptz,
  next_payment_at timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(company_id) -- One active subscription per company
);

-- ============================================
-- 4. CREATE USAGE TRACKING TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS company_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Usage Period
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  
  -- Counters
  deals_created integer DEFAULT 0,
  offers_created integer DEFAULT 0,
  pdfs_generated integer DEFAULT 0,
  whatsapp_sent integer DEFAULT 0,
  emails_sent integer DEFAULT 0,
  storage_used_mb numeric DEFAULT 0,
  
  -- API Usage (for Pro plan)
  api_calls integer DEFAULT 0,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(company_id, period_start)
);

-- ============================================
-- 5. AUTO-CREATE FREE SUBSCRIPTION FOR NEW COMPANIES
-- ============================================
CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS TRIGGER AS $$
DECLARE
  v_free_plan_id uuid;
BEGIN
  -- Get free plan ID
  SELECT id INTO v_free_plan_id
  FROM subscription_plans
  WHERE name = 'free'
  LIMIT 1;
  
  -- Create subscription (30 days)
  INSERT INTO company_subscriptions (
    company_id, 
    plan_id,
    status,
    current_period_start,
    current_period_end
  ) VALUES (
    NEW.id,
    v_free_plan_id,
    'active',
    now(),
    now() + interval '30 days'
  );
  
  -- Create usage tracking record
  INSERT INTO company_usage (
    company_id,
    period_start,
    period_end
  ) VALUES (
    NEW.id,
    date_trunc('month', now()),
    date_trunc('month', now()) + interval '1 month'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_company_subscription
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION create_default_subscription();

-- ============================================
-- 6. HELPER FUNCTION: Check Plan Limit
-- ============================================
CREATE OR REPLACE FUNCTION check_plan_limit(
  p_company_id uuid,
  p_limit_type text -- 'users', 'deals', 'storage'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_plan subscription_plans%ROWTYPE;
  v_usage company_usage%ROWTYPE;
  v_current_count integer;
  v_limit integer;
  v_allowed boolean;
BEGIN
  -- Get current plan
  SELECT sp.* INTO v_plan
  FROM subscription_plans sp
  JOIN company_subscriptions cs ON cs.plan_id = sp.id
  WHERE cs.company_id = p_company_id
    AND cs.status = 'active';
  
  -- Get current usage
  SELECT * INTO v_usage
  FROM company_usage
  WHERE company_id = p_company_id
    AND period_start = date_trunc('month', now());
  
  -- Check specific limit
  CASE p_limit_type
    WHEN 'users' THEN
      SELECT COUNT(*) INTO v_current_count
      FROM company_members
      WHERE company_id = p_company_id;
      v_limit := v_plan.max_users;
      
    WHEN 'deals' THEN
      v_current_count := COALESCE(v_usage.deals_created, 0);
      v_limit := v_plan.max_deals_per_month;
      
    WHEN 'storage' THEN
      v_current_count := COALESCE(v_usage.storage_used_mb, 0)::integer;
      v_limit := v_plan.max_storage_mb;
      
    ELSE
      RAISE EXCEPTION 'Unknown limit type: %', p_limit_type;
  END CASE;
  
  -- NULL limit = unlimited
  IF v_limit IS NULL THEN
    v_allowed := true;
  ELSE
    v_allowed := v_current_count < v_limit;
  END IF;
  
  -- Return result
  v_result := jsonb_build_object(
    'allowed', v_allowed,
    'current', v_current_count,
    'limit', v_limit,
    'plan', v_plan.name
  );
  
  RETURN v_result;
END;
$$;

-- ============================================
-- 7. HELPER FUNCTION: Check Feature Access
-- ============================================
CREATE OR REPLACE FUNCTION has_feature(
  p_company_id uuid,
  p_feature text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_feature boolean;
BEGIN
  SELECT (sp.features->>p_feature)::boolean INTO v_has_feature
  FROM subscription_plans sp
  JOIN company_subscriptions cs ON cs.plan_id = sp.id
  WHERE cs.company_id = p_company_id
    AND cs.status = 'active';
  
  RETURN COALESCE(v_has_feature, false);
END;
$$;

-- ============================================
-- 8. FUNCTION: Increment Usage Counter
-- ============================================
CREATE OR REPLACE FUNCTION increment_usage(
  p_company_id uuid,
  p_counter text,
  p_amount integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_period_start timestamptz := date_trunc('month', now());
  v_period_end timestamptz := v_period_start + interval '1 month';
BEGIN
  -- Upsert usage record
  INSERT INTO company_usage (
    company_id,
    period_start,
    period_end
  ) VALUES (
    p_company_id,
    v_period_start,
    v_period_end
  )
  ON CONFLICT (company_id, period_start) DO NOTHING;
  
  -- Increment counter
  CASE p_counter
    WHEN 'deals' THEN
      UPDATE company_usage
      SET deals_created = deals_created + p_amount
      WHERE company_id = p_company_id AND period_start = v_period_start;
      
    WHEN 'offers' THEN
      UPDATE company_usage
      SET offers_created = offers_created + p_amount
      WHERE company_id = p_company_id AND period_start = v_period_start;
      
    WHEN 'pdfs' THEN
      UPDATE company_usage
      SET pdfs_generated = pdfs_generated + p_amount
      WHERE company_id = p_company_id AND period_start = v_period_start;
      
    WHEN 'whatsapp' THEN
      UPDATE company_usage
      SET whatsapp_sent = whatsapp_sent + p_amount
      WHERE company_id = p_company_id AND period_start = v_period_start;
      
    WHEN 'emails' THEN
      UPDATE company_usage
      SET emails_sent = emails_sent + p_amount
      WHERE company_id = p_company_id AND period_start = v_period_start;
      
    ELSE
      RAISE NOTICE 'Unknown counter: %', p_counter;
  END CASE;
END;
$$;

-- ============================================
-- 9. ADD INDEXES
-- ============================================
CREATE INDEX idx_company_subscriptions_company 
  ON company_subscriptions(company_id);

CREATE INDEX idx_company_subscriptions_status 
  ON company_subscriptions(status);

CREATE INDEX idx_company_usage_company_period 
  ON company_usage(company_id, period_start);

-- ============================================
-- 10. BACKFILL SUBSCRIPTIONS FOR EXISTING COMPANIES
-- ============================================
DO $$
DECLARE
  v_free_plan_id uuid;
  v_company record;
BEGIN
  -- Get free plan ID
  SELECT id INTO v_free_plan_id
  FROM subscription_plans
  WHERE name = 'free'
  LIMIT 1;
  
  -- Create subscriptions for existing companies
  FOR v_company IN SELECT id FROM companies LOOP
    INSERT INTO company_subscriptions (
      company_id,
      plan_id,
      status,
      current_period_start,
      current_period_end
    ) VALUES (
      v_company.id,
      v_free_plan_id,
      'active',
      now(),
      now() + interval '365 days' -- Give existing companies 1 year free
    )
    ON CONFLICT (company_id) DO NOTHING;
    
    -- Create usage record
    INSERT INTO company_usage (
      company_id,
      period_start,
      period_end
    ) VALUES (
      v_company.id,
      date_trunc('month', now()),
      date_trunc('month', now()) + interval '1 month'
    )
    ON CONFLICT (company_id, period_start) DO NOTHING;
  END LOOP;
END $$;

-- ============================================
-- 11. ADD COMMENTS
-- ============================================
COMMENT ON TABLE subscription_plans IS 'Available subscription plans (Free, Basic, Pro)';
COMMENT ON TABLE company_subscriptions IS 'Active subscriptions for each company';
COMMENT ON TABLE company_usage IS 'Monthly usage tracking per company';
COMMENT ON FUNCTION check_plan_limit IS 'Check if company has reached plan limit (users/deals/storage)';
COMMENT ON FUNCTION has_feature IS 'Check if company has access to specific feature';
COMMENT ON FUNCTION increment_usage IS 'Increment usage counter (deals/offers/pdfs/whatsapp/emails)';

