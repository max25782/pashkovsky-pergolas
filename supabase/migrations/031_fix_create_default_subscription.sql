-- Fix create_default_subscription function
-- Issue: References 'name' column which doesn't exist in subscription_plans
-- Should use 'plan_key' instead

CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS TRIGGER AS $$
DECLARE
  v_trial_plan_id uuid;
BEGIN
  -- Get trial plan ID (use plan_key instead of name)
  SELECT id INTO v_trial_plan_id
  FROM subscription_plans
  WHERE plan_key = 'trial'
  LIMIT 1;
  
  -- Only create subscription if trial plan exists
  IF v_trial_plan_id IS NOT NULL THEN
    -- Create subscription (14 days trial)
    INSERT INTO company_subscriptions (
      company_id, 
      plan_id,
      status,
      payment_provider,
      trial_ends_at,
      current_period_end
    ) VALUES (
      NEW.id,
      v_trial_plan_id,
      'trialing',
      'manual',
      now() + interval '14 days',
      now() + interval '14 days'
    )
    ON CONFLICT (company_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Comment for reference
COMMENT ON FUNCTION create_default_subscription() IS 'Auto-creates trial subscription for new companies. Fixed to use plan_key instead of name column. billing_cycle is nullable so omitted.';


