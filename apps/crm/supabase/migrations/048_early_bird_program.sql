-- Early Bird program: first 20 companies to register get a numbered spot.
-- Used by registration flow to grant 14-day full-access trial vs 3-day default.
-- Atomic claim via SELECT FOR UPDATE on a sentinel row to prevent race conditions.

-- 1) Add columns on companies
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS early_bird_position INT;

ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS trial_reminder_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.companies.early_bird_position IS
  'Position (1..20) in the Early Bird cohort. NULL for companies outside the cohort. Granted at registration time.';

COMMENT ON COLUMN public.companies.trial_reminder_sent_at IS
  'Timestamp of the most recent trial-ending reminder email. Used for dedup by the trial-reminders cron.';

-- Partial unique index: enforce uniqueness only for non-NULL positions
CREATE UNIQUE INDEX IF NOT EXISTS companies_early_bird_position_uniq
  ON public.companies (early_bird_position)
  WHERE early_bird_position IS NOT NULL;

-- 2) Sentinel/lock table — single row provides advisory lock target for atomic claims
CREATE TABLE IF NOT EXISTS public.early_bird_program (
  id INT PRIMARY KEY DEFAULT 1,
  total_spots INT NOT NULL DEFAULT 20,
  CONSTRAINT early_bird_program_singleton CHECK (id = 1)
);

INSERT INTO public.early_bird_program (id, total_spots)
VALUES (1, 20)
ON CONFLICT (id) DO NOTHING;

-- 3) Atomic spot claim function.
-- Returns the assigned position (1..total_spots) or NULL if the cohort is full.
-- Uses SELECT FOR UPDATE on the singleton row to serialize concurrent registrations.
CREATE OR REPLACE FUNCTION public.claim_early_bird_spot(p_company_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total      INT;
  v_used       INT;
  v_position   INT;
  v_already    INT;
BEGIN
  -- If this company already has a position, return it (idempotent on retry)
  SELECT early_bird_position INTO v_already
  FROM public.companies
  WHERE id = p_company_id;

  IF v_already IS NOT NULL THEN
    RETURN v_already;
  END IF;

  -- Acquire row-level lock on the singleton sentinel
  SELECT total_spots INTO v_total
  FROM public.early_bird_program
  WHERE id = 1
  FOR UPDATE;

  IF v_total IS NULL THEN
    RETURN NULL;
  END IF;

  -- Count current cohort size under the lock
  SELECT COUNT(*) INTO v_used
  FROM public.companies
  WHERE early_bird_position IS NOT NULL;

  IF v_used >= v_total THEN
    RETURN NULL;
  END IF;

  v_position := v_used + 1;

  UPDATE public.companies
  SET early_bird_position = v_position
  WHERE id = p_company_id;

  RETURN v_position;
END;
$$;

COMMENT ON FUNCTION public.claim_early_bird_spot(UUID) IS
  'Atomically assign the next Early Bird position to a company. Returns position (1..N) or NULL if cohort is full.';

-- 4) Public counter: how many spots remain (raw, unfloored)
CREATE OR REPLACE FUNCTION public.get_early_bird_spots_remaining()
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(
    0,
    (SELECT total_spots FROM public.early_bird_program WHERE id = 1)
      - (SELECT COUNT(*)::INT FROM public.companies WHERE early_bird_position IS NOT NULL)
  );
$$;

COMMENT ON FUNCTION public.get_early_bird_spots_remaining() IS
  'Returns the number of unclaimed Early Bird spots. Hybrid floor (e.g. min 5) is applied at the API layer, not here.';

-- 5) Grants — anon can read remaining count via the public API
GRANT EXECUTE ON FUNCTION public.get_early_bird_spots_remaining() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_early_bird_spot(UUID) TO authenticated, service_role;
