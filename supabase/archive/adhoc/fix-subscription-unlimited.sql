-- Fix existing subscription for oryaron38 company
-- Make it unlimited (no expiration)

UPDATE company_subscriptions
SET 
  trial_ends_at = NULL,
  current_period_end = NULL,
  next_billing_date = NULL,
  auto_renew = false,
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
  cs.auto_renew
FROM company_subscriptions cs
JOIN companies c ON cs.company_id = c.id
JOIN subscription_plans sp ON cs.plan_id = sp.id
WHERE cs.company_id = '82b7f5ca-50bd-4675-a62a-dc2e8f2849df';




