-- Google Ads offline conversion tracking via gclid
-- Add columns to leads table for gclid capture and conversion sent flag

ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS gclid TEXT;

ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS google_conv_sent BOOLEAN DEFAULT FALSE;

ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS google_conv_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_leads_gclid ON public.leads(gclid) WHERE gclid IS NOT NULL;

COMMENT ON COLUMN public.leads.gclid IS 'Google Click ID for offline conversion tracking';
COMMENT ON COLUMN public.leads.google_conv_sent IS 'Whether offline conversion was successfully sent to Google Ads';
COMMENT ON COLUMN public.leads.google_conv_sent_at IS 'When offline conversion was sent to Google Ads';
