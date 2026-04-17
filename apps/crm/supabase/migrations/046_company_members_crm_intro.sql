-- Per-user-per-company completion for the CRM 3-step intro modal (Quick Offer / dashboard tour).
-- NULL = show intro. New company_members rows default to NULL (new companies & new invites).

ALTER TABLE public.company_members
  ADD COLUMN IF NOT EXISTS crm_intro_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.company_members.crm_intro_completed_at IS
  'When set, the user finished the CRM intro modal for this company. NULL = show intro.';

-- No backfill: existing rows stay NULL until each user completes the intro (or you set NOW() via SQL).
