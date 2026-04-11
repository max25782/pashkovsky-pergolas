-- Per-user SaaS tier for feature gating (billing integration later).
-- Existing users get full access (growth); new rows default to offer.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS plan TEXT;

UPDATE public.users
SET plan = 'growth'
WHERE plan IS NULL;

ALTER TABLE public.users
  ALTER COLUMN plan SET DEFAULT 'offer',
  ALTER COLUMN plan SET NOT NULL;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_saas_plan_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_saas_plan_check
  CHECK (plan IN ('offer', 'pro', 'business', 'growth'));

COMMENT ON COLUMN public.users.plan IS 'SaaS tier: offer, pro, business, growth';
