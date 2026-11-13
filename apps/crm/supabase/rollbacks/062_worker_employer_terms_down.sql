-- Rollback for 062_worker_employer_terms.sql.
--
-- NOT APPLIED. Drops the history table and the three worker columns. Values
-- entered in them are lost; before this runs, project cost goes back to the
-- plain day rate and the pension rows disappear from Tazrim on the next sync.

BEGIN;

DROP TABLE IF EXISTS public.worker_rate_history;

ALTER TABLE public.workers
  DROP CONSTRAINT IF EXISTS workers_employer_coefficient_check,
  DROP CONSTRAINT IF EXISTS workers_pension_rate_check;
ALTER TABLE public.workers
  DROP COLUMN IF EXISTS employer_coefficient,
  DROP COLUMN IF EXISTS pension_rate,
  DROP COLUMN IF EXISTS pension_exempt;

COMMIT;
