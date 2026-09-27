-- ==========================================
-- Subscription Management Schema
-- ==========================================
-- This migration creates tables for subscription plans and billing

-- 0. Create or replace update_updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.update_updated_at() IS 'Trigger function to automatically update updated_at timestamp';

-- Drop existing tables if they exist (clean slate)
DROP TABLE IF EXISTS public.platform_admins CASCADE;
DROP TABLE IF EXISTS public.subscription_history CASCADE;
DROP TABLE IF EXISTS public.company_subscriptions CASCADE;
DROP TABLE IF EXISTS public.subscription_plans CASCADE;

-- 1. Create subscription_plans table
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_key VARCHAR(30) UNIQUE NOT NULL, -- 'trial', 'basic', 'pro', 'enterprise'
  display_name JSONB NOT NULL, -- {"en": "Pro Plan", "he": "תוכנית Pro", "ru": "План Pro"}
  price_monthly DECIMAL(10,2) NOT NULL,
  price_yearly DECIMAL(10,2),
  features JSONB NOT NULL, -- ["feature1", "feature2", ...]
  limits JSONB NOT NULL, -- {"users": 10, "deals": 1000, "storage_gb": 50}
  is_active BOOLEAN DEFAULT true,
  sort_order INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment
COMMENT ON TABLE public.subscription_plans IS 'Available subscription plans with pricing and features';

-- 2. Create company_subscriptions table
CREATE TABLE public.company_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.subscription_plans(id),

  status VARCHAR(20) NOT NULL 
    CHECK (status IN ('trialing','active','past_due','canceled','suspended')),

  payment_provider VARCHAR(20)
    CHECK (payment_provider IN ('stripe','manual','bit','paybox')),

  payment_provider_subscription_id VARCHAR(255),
  payment_provider_customer_id VARCHAR(255),

  billing_cycle VARCHAR(20) CHECK (billing_cycle IN ('monthly','yearly')),
  auto_renew BOOLEAN DEFAULT true,

  trial_ends_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  next_billing_date TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment
COMMENT ON TABLE public.company_subscriptions IS 'Company subscription status and billing information';

-- Create indexes
CREATE INDEX idx_company_subscriptions_company_id ON public.company_subscriptions(company_id);
CREATE INDEX idx_company_subscriptions_plan_id ON public.company_subscriptions(plan_id);
CREATE INDEX idx_company_subscriptions_status ON public.company_subscriptions(status);

-- 3. Create subscription_history table
CREATE TABLE public.subscription_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  old_plan_id UUID REFERENCES public.subscription_plans(id),
  new_plan_id UUID REFERENCES public.subscription_plans(id),
  changed_by UUID REFERENCES auth.users(id),
  change_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment
COMMENT ON TABLE public.subscription_history IS 'History of subscription plan changes';

-- Create index
CREATE INDEX idx_subscription_history_company_id ON public.subscription_history(company_id);
CREATE INDEX idx_subscription_history_created_at ON public.subscription_history(created_at DESC);

-- 4. Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_company_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER company_subscriptions_updated_at
  BEFORE UPDATE ON public.company_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_company_subscriptions_updated_at();

-- 5. Insert default subscription plans
INSERT INTO public.subscription_plans (plan_key, display_name, price_monthly, price_yearly, features, limits, is_active, sort_order)
VALUES
  -- Trial Plan
  (
    'trial',
    '{"en": "Trial", "he": "תקופת ניסיון", "ru": "Пробный период"}'::jsonb,
    0.00,
    0.00,
    '["2 users", "50 deals", "1 GB storage", "Email support"]'::jsonb,
    '{"users": 2, "deals": 50, "storage_gb": 1, "ai_requests_per_month": 100}'::jsonb,
    true,
    1
  ),
  -- Basic Plan
  (
    'basic',
    '{"en": "Basic", "he": "בסיסי", "ru": "Базовый"}'::jsonb,
    99.00,
    990.00, -- 2 months free
    '["5 users", "500 deals", "10 GB storage", "Email support", "Basic analytics"]'::jsonb,
    '{"users": 5, "deals": 500, "storage_gb": 10, "ai_requests_per_month": 500}'::jsonb,
    true,
    2
  ),
  -- Pro Plan
  (
    'pro',
    '{"en": "Pro", "he": "מקצועי", "ru": "Профессиональный"}'::jsonb,
    299.00,
    2990.00,
    '["20 users", "5000 deals", "100 GB storage", "Priority support", "Advanced analytics", "API access"]'::jsonb,
    '{"users": 20, "deals": 5000, "storage_gb": 100, "ai_requests_per_month": 2000}'::jsonb,
    true,
    3
  ),
  -- Enterprise Plan
  (
    'enterprise',
    '{"en": "Enterprise", "he": "ארגוני", "ru": "Корпоративный"}'::jsonb,
    899.00,
    8990.00,
    '["Unlimited users", "Unlimited deals", "1 TB storage", "24/7 support", "Custom analytics", "API access", "Custom integrations", "Dedicated account manager"]'::jsonb,
    '{"users": -1, "deals": -1, "storage_gb": 1000, "ai_requests_per_month": -1}'::jsonb,
    true,
    4
  )
ON CONFLICT (plan_key) DO NOTHING;

-- 6. Migrate existing companies to trial plan
DO $$
DECLARE
  trial_plan_id UUID;
BEGIN
  -- Get trial plan id
  SELECT id INTO trial_plan_id FROM public.subscription_plans WHERE plan_key = 'trial';
  
  -- Insert trial subscriptions for all companies that don't have a subscription
  INSERT INTO public.company_subscriptions (
    company_id,
    plan_id,
    status,
    payment_provider,
    trial_ends_at,
    current_period_end
  )
  SELECT 
    c.id,
    trial_plan_id,
    'trialing',
    'manual',
    NOW() + INTERVAL '14 days',
    NOW() + INTERVAL '14 days'
  FROM public.companies c
  WHERE NOT EXISTS (
    SELECT 1 FROM public.company_subscriptions cs WHERE cs.company_id = c.id
  );
END $$;

-- 7. Enable RLS on new tables
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;

-- 8. Create RLS Policies

-- subscription_plans: Everyone can view active plans
CREATE POLICY "Anyone can view active subscription plans"
  ON public.subscription_plans
  FOR SELECT
  USING (is_active = true);

-- company_subscriptions: Users can view their own company subscription
CREATE POLICY "Users can view their company subscription"
  ON public.company_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM public.company_members 
      WHERE user_id = auth.uid()
    )
  );

-- company_subscriptions: Company owners can update subscription
CREATE POLICY "Company owners can update subscription"
  ON public.company_subscriptions
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM public.company_members 
      WHERE user_id = auth.uid() 
        AND role = 'owner'
    )
  );

-- subscription_history: Users can view their company history
CREATE POLICY "Users can view their company subscription history"
  ON public.subscription_history
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM public.company_members 
      WHERE user_id = auth.uid()
    )
  );

-- subscription_history: System can insert history records
CREATE POLICY "Service role can insert subscription history"
  ON public.subscription_history
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 9. Create platform_admins table for SuperAdmin management
CREATE TABLE public.platform_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('SUPERADMIN', 'SUPPORT')),
  permissions jsonb DEFAULT '{
    "manage_all_companies": true,
    "view_analytics": true,
    "manage_plans": true,
    "manage_billing": true
  }'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add index
CREATE INDEX idx_platform_admins_user_id ON public.platform_admins(user_id);
CREATE INDEX idx_platform_admins_role ON public.platform_admins(role);

-- Add trigger for updated_at
CREATE TRIGGER set_platform_admins_updated_at
  BEFORE UPDATE ON public.platform_admins
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Enable RLS on platform_admins
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- Only platform admins can view other platform admins
CREATE POLICY "Platform admins can view platform admins"
  ON public.platform_admins
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid() 
        AND pa.is_active = true
    )
  );

-- Service role can manage platform admins
CREATE POLICY "Service role can manage platform admins"
  ON public.platform_admins
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 10. Grant permissions
GRANT SELECT ON public.subscription_plans TO authenticated;
GRANT SELECT, UPDATE ON public.company_subscriptions TO authenticated;
GRANT SELECT ON public.subscription_history TO authenticated;
GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;
GRANT ALL ON public.company_subscriptions TO service_role;
GRANT ALL ON public.subscription_history TO service_role;
GRANT ALL ON public.platform_admins TO service_role;

-- 11. Insert your user as SUPERADMIN (replace with your auth.users.id)
-- Find your user_id first:
-- SELECT id, email FROM auth.users WHERE email = 'office@pashkovsky-group.com';
-- Then uncomment and update:
-- INSERT INTO public.platform_admins (user_id, role)
-- VALUES ('41bc1d19-aa1f-4427-b739-98003bea8528', 'SUPERADMIN')
-- ON CONFLICT (user_id) DO UPDATE SET role = 'SUPERADMIN', is_active = true;

