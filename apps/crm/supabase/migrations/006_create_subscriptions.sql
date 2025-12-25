-- ============================================
-- Phase 3: Billing & Features
-- Create subscriptions table
-- ============================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES plans(id),
  
  -- Billing provider
  provider TEXT CHECK (provider IN ('tranzila', 'stripe', 'manual')),
  provider_subscription_id TEXT, -- ID from Tranzila/Stripe
  provider_customer_id TEXT, -- Customer ID from provider
  provider_payment_method_id TEXT, -- Payment method ID
  
  -- Status
  status TEXT CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid')),
  
  -- Billing period
  billing_interval TEXT CHECK (billing_interval IN ('monthly', 'yearly')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMPTZ,
  
  -- Trial
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  
  -- Payment tracking
  last_payment_date TIMESTAMPTZ,
  last_payment_amount DECIMAL(10,2),
  last_payment_status TEXT,
  next_payment_date TIMESTAMPTZ,
  next_payment_amount DECIMAL(10,2),
  
  -- Usage tracking (for metered billing if needed)
  usage_current_period JSONB DEFAULT '{}'::jsonb,
  /*
  Example usage structure:
  {
    "deals_created": 45,
    "users_count": 3,
    "storage_used_gb": 2.5,
    "api_calls": 1250
  }
  */
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(company_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_company ON subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider ON subscriptions(provider, provider_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_payment ON subscriptions(next_payment_date);

-- Subscription history table (for audit trail)
CREATE TABLE IF NOT EXISTS subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Event details
  event_type TEXT NOT NULL, -- 'created', 'updated', 'canceled', 'payment_succeeded', 'payment_failed', etc.
  old_status TEXT,
  new_status TEXT,
  old_plan_id UUID,
  new_plan_id UUID,
  
  -- Payment details (if applicable)
  amount DECIMAL(10,2),
  currency TEXT,
  provider_event_id TEXT, -- Event ID from provider
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for history
CREATE INDEX IF NOT EXISTS idx_subscription_history_subscription ON subscription_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_company ON subscription_history(company_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_created_at ON subscription_history(created_at DESC);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_subscriptions_updated_at();

-- Create trigger to log subscription changes
CREATE OR REPLACE FUNCTION log_subscription_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Log status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO subscription_history (
        subscription_id, company_id, event_type,
        old_status, new_status
      ) VALUES (
        NEW.id, NEW.company_id, 'status_changed',
        OLD.status, NEW.status
      );
    END IF;
    
    -- Log plan changes
    IF OLD.plan_id IS DISTINCT FROM NEW.plan_id THEN
      INSERT INTO subscription_history (
        subscription_id, company_id, event_type,
        old_plan_id, new_plan_id
      ) VALUES (
        NEW.id, NEW.company_id, 'plan_changed',
        OLD.plan_id, NEW.plan_id
      );
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO subscription_history (
      subscription_id, company_id, event_type,
      new_status, new_plan_id
    ) VALUES (
      NEW.id, NEW.company_id, 'created',
      NEW.status, NEW.plan_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for logging
DROP TRIGGER IF EXISTS log_subscription_changes ON subscriptions;
CREATE TRIGGER log_subscription_changes
  AFTER INSERT OR UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION log_subscription_changes();

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Subscriptions table created successfully';
  RAISE NOTICE '✅ Subscription history table created for audit trail';
  RAISE NOTICE '✅ Automatic logging enabled for subscription changes';
END $$;



