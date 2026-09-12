-- ==========================================
-- Add Subscription for Pashkovsky Group
-- ==========================================

-- Step 1: Check if subscription already exists
SELECT 
  cs.id,
  c.name as company_name,
  sp.display_name as plan_name,
  cs.status,
  cs.billing_cycle
FROM company_subscriptions cs
JOIN companies c ON c.id = cs.company_id
JOIN subscription_plans sp ON sp.id = cs.plan_id
WHERE c.id = '6998295e-89ae-4e3d-afd2-8c2b0333eac2';

-- Step 2: If no subscription, create one
-- Get the Enterprise plan ID
DO $$
DECLARE
  v_company_id UUID := '6998295e-89ae-4e3d-afd2-8c2b0333eac2';
  v_plan_id UUID;
BEGIN
  -- Get Enterprise plan ID (or fallback to trial)
  SELECT id INTO v_plan_id
  FROM subscription_plans
  WHERE plan_key = 'enterprise'
  LIMIT 1;
  
  -- If no enterprise plan, use trial
  IF v_plan_id IS NULL THEN
    SELECT id INTO v_plan_id
    FROM subscription_plans
    WHERE plan_key = 'trial'
    LIMIT 1;
  END IF;
  
  -- Insert subscription if not exists
  INSERT INTO company_subscriptions (
    company_id,
    plan_id,
    status,
    billing_cycle
  )
  SELECT
    v_company_id,
    v_plan_id,
    'active',
    'monthly'
  WHERE NOT EXISTS (
    SELECT 1 FROM company_subscriptions
    WHERE company_id = v_company_id
  );
  
  RAISE NOTICE 'Subscription created or already exists';
END $$;

-- Step 3: Verify
SELECT 
  cs.id,
  c.name as company_name,
  sp.plan_key,
  sp.display_name->>'en' as plan_display_name,
  cs.status,
  cs.billing_cycle,
  cs.created_at,
  cs.updated_at,
  '✓ Subscription ready!' as result
FROM company_subscriptions cs
JOIN companies c ON c.id = cs.company_id
JOIN subscription_plans sp ON sp.id = cs.plan_id
WHERE c.id = '6998295e-89ae-4e3d-afd2-8c2b0333eac2';

