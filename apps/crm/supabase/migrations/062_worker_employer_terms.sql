-- Workers: employer coefficient, pension rate, "no pension" flag and their history.
--
-- NOT APPLIED. Review, then apply by hand (SQL editor or `supabase db push`).
-- Reversible: rollbacks/062_worker_employer_terms_down.sql.
--
-- The app tolerates this migration not being applied yet (it reads workers with
-- select('*'), treats a missing column as the default and a missing history table
-- as "no history"), so deploying code first and applying this after is safe.
--
-- Columns on workers (all with defaults, so existing rows are valid at once):
--   employer_coefficient  percent on top of the day rate, default 25.
--                         500 a day at 25% costs the project 625. It already
--                         includes pension, so pension is never subtracted again.
--   pension_rate          percent of the employer gross paid to the pension and
--                         pitzuim funds, default 12.5. Cash flow only.
--   pension_exempt        true = no pension row for this worker (self-employed).
--
-- worker_rate_history: one row per change of those three terms, effective from a
-- date, so a mid-month change is costed per day. Day and hourly rates are NOT
-- stored here (nullable columns exist, unused) so how rate changes already
-- behave does not change. The app writes a baseline row (old values, effective
-- from 1970-01-01) the first time a worker's terms change.

BEGIN;

ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS employer_coefficient numeric NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS pension_rate numeric NOT NULL DEFAULT 12.5,
  ADD COLUMN IF NOT EXISTS pension_exempt boolean NOT NULL DEFAULT false;

ALTER TABLE public.workers
  DROP CONSTRAINT IF EXISTS workers_employer_coefficient_check,
  DROP CONSTRAINT IF EXISTS workers_pension_rate_check;
ALTER TABLE public.workers
  ADD CONSTRAINT workers_employer_coefficient_check CHECK (employer_coefficient >= 0 AND employer_coefficient <= 200),
  ADD CONSTRAINT workers_pension_rate_check CHECK (pension_rate >= 0 AND pension_rate <= 100);

CREATE TABLE IF NOT EXISTS public.worker_rate_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  effective_from date NOT NULL,
  employer_coefficient numeric,
  pension_rate numeric,
  pension_exempt boolean,
  daily_rate numeric,
  hourly_rate numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT worker_rate_history_worker_date_key UNIQUE (worker_id, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_worker_rate_history_company
  ON public.worker_rate_history (company_id, worker_id, effective_from);

ALTER TABLE public.worker_rate_history ENABLE ROW LEVEL SECURITY;

-- Same model as public.workers: the API uses the service role; signed-in
-- members may read their own company's rows.
CREATE POLICY "Service role can do everything on worker_rate_history"
  ON public.worker_rate_history AS PERMISSIVE FOR ALL TO PUBLIC
  USING (auth.role() = 'service_role'::text);
CREATE POLICY "Users can view own company worker_rate_history"
  ON public.worker_rate_history AS PERMISSIVE FOR SELECT TO PUBLIC
  USING (company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()));

COMMIT;
