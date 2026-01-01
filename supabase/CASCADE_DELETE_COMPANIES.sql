-- ==========================================
-- Configure CASCADE DELETE for Companies
-- When a company is deleted, all related data should be deleted too
-- ==========================================

-- 1. company_members
ALTER TABLE public.company_members
DROP CONSTRAINT IF EXISTS company_members_company_id_fkey;

ALTER TABLE public.company_members
ADD CONSTRAINT company_members_company_id_fkey
FOREIGN KEY (company_id)
REFERENCES public.companies(id)
ON DELETE CASCADE;

-- 2. deals
ALTER TABLE public.deals
DROP CONSTRAINT IF EXISTS deals_company_id_fkey;

ALTER TABLE public.deals
ADD CONSTRAINT deals_company_id_fkey
FOREIGN KEY (company_id)
REFERENCES public.companies(id)
ON DELETE CASCADE;

-- 3. leads
ALTER TABLE public.leads
DROP CONSTRAINT IF EXISTS leads_company_id_fkey;

ALTER TABLE public.leads
ADD CONSTRAINT leads_company_id_fkey
FOREIGN KEY (company_id)
REFERENCES public.companies(id)
ON DELETE CASCADE;

-- 4. offers
ALTER TABLE public.offers
DROP CONSTRAINT IF EXISTS offers_company_id_fkey;

ALTER TABLE public.offers
ADD CONSTRAINT offers_company_id_fkey
FOREIGN KEY (company_id)
REFERENCES public.companies(id)
ON DELETE CASCADE;

-- 5. workers
ALTER TABLE public.workers
DROP CONSTRAINT IF EXISTS workers_company_id_fkey;

ALTER TABLE public.workers
ADD CONSTRAINT workers_company_id_fkey
FOREIGN KEY (company_id)
REFERENCES public.companies(id)
ON DELETE CASCADE;

-- 6. company_settings
ALTER TABLE public.company_settings
DROP CONSTRAINT IF EXISTS company_settings_company_id_fkey;

ALTER TABLE public.company_settings
ADD CONSTRAINT company_settings_company_id_fkey
FOREIGN KEY (company_id)
REFERENCES public.companies(id)
ON DELETE CASCADE;

-- 7. company_subscriptions
ALTER TABLE public.company_subscriptions
DROP CONSTRAINT IF EXISTS company_subscriptions_company_id_fkey;

ALTER TABLE public.company_subscriptions
ADD CONSTRAINT company_subscriptions_company_id_fkey
FOREIGN KEY (company_id)
REFERENCES public.companies(id)
ON DELETE CASCADE;

-- 8. subscription_history
ALTER TABLE public.subscription_history
DROP CONSTRAINT IF EXISTS subscription_history_company_id_fkey;

ALTER TABLE public.subscription_history
ADD CONSTRAINT subscription_history_company_id_fkey
FOREIGN KEY (company_id)
REFERENCES public.companies(id)
ON DELETE CASCADE;

-- Verify
SELECT
  tc.table_name,
  tc.constraint_name,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND rc.delete_rule = 'CASCADE'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;

