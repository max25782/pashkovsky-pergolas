-- Calculated VAT / pension breakdown moves out of notes into calc_meta (jsonb).
-- notes stays for human-readable text only (manual expenses, payroll labels, CRM).
--
-- Safe to re-run: ADD COLUMN IF NOT EXISTS; one-time backfill from JSON notes.

ALTER TABLE public.tz_cash_events
  ADD COLUMN IF NOT EXISTS calc_meta jsonb;

COMMENT ON COLUMN public.tz_cash_events.calc_meta IS
  'Locale-neutral calculated-row payload (VAT/pension breakdown). UI builds labels from kind + sourceMonth.';

-- Move existing CalcMeta JSON out of notes so lists never show raw keys.
-- Filter with LIKE first so Postgres never casts free-text notes to jsonb.
WITH candidates AS (
  SELECT id, notes
  FROM public.tz_cash_events
  WHERE calc_meta IS NULL
    AND notes IS NOT NULL
    AND left(btrim(notes), 1) = '{'
    AND notes LIKE '%"kind"%'
    AND notes LIKE '%"v":1%'
    AND notes LIKE '%"sourceMonth"%'
)
UPDATE public.tz_cash_events e
SET
  calc_meta = c.notes::jsonb,
  notes = NULL
FROM candidates c
WHERE e.id = c.id;
