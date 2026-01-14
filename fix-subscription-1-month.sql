-- Set subscription for oryaron38 company to 1 month Enterprise plan
-- Expires after 1 month from now

UPDATE company_subscriptions
SET 
  trial_ends_at = NULL, -- No trial, it's a paid plan
  current_period_end = NOW() + INTERVAL '1 month', -- Expires in 1 month
  next_billing_date = NOW() + INTERVAL '1 month', -- Next billing in 1 month
  auto_renew = false, -- Don't auto-renew
  payment_provider = 'manual',
  status = 'active'
WHERE company_id = '82b7f5ca-50bd-4675-a62a-dc2e8f2849df';

-- Verify the update
SELECT 
  cs.id,
  cs.company_id,
  c.name as company_name,
  sp.plan_key,
  cs.status,
  cs.payment_provider,
  cs.trial_ends_at,
  cs.current_period_end,
  cs.next_billing_date,
  cs.auto_renew,
  -- Show how many days left
  EXTRACT(DAY FROM (cs.current_period_end - NOW())) as days_left
FROM company_subscriptions cs
JOIN companies c ON cs.company_id = c.id
JOIN subscription_plans sp ON cs.plan_id = sp.id
WHERE cs.company_id = '82b7f5ca-50bd-4675-a62a-dc2e8f2849df';




