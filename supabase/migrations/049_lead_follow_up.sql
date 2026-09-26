-- Callback date for a sales follow-up. Null means no call is scheduled.
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS follow_up_at timestamptz;

COMMENT ON COLUMN public.leads.follow_up_at IS 'When the sales manager should call this lead again';

CREATE INDEX IF NOT EXISTS idx_leads_company_follow_up
  ON public.leads (company_id, follow_up_at)
  WHERE follow_up_at IS NOT NULL;
