-- ==========================================
-- Simple: Add Subscription for Pashkovsky Group
-- ==========================================

-- Step 1: Delete old subscription (if exists)
DELETE FROM company_subscriptions 
WHERE company_id = '6998295e-89ae-4e3d-afd2-8c2b0333eac2';

-- Step 2: Add new subscription with Enterprise plan
INSERT INTO company_subscriptions (
  company_id,
  plan_id,
  status,
  billing_cycle
)
SELECT 
  '6998295e-89ae-4e3d-afd2-8c2b0333eac2'::UUID,
  sp.id,
  'active',
  'monthly'
FROM subscription_plans sp
WHERE sp.plan_key = 'enterprise'
LIMIT 1;

-- Step 3: Verify result
SELECT 
  cs.id,
  c.name as company_name,
  sp.plan_key,
  sp.display_name->>'en' as plan_display_name,
  cs.status,
  cs.billing_cycle,
  cs.created_at,
  '✓ SUCCESS! Subscription created' as result
FROM company_subscriptions cs
JOIN companies c ON c.id = cs.company_id
JOIN subscription_plans sp ON sp.id = cs.plan_id
WHERE c.id = '6998295e-89ae-4e3d-afd2-8c2b0333eac2';

