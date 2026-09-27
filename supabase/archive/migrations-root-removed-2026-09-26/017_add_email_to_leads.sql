-- Add missing columns to leads table
-- These fields are used by the public leads API

-- Add email column (optional)
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Add message column (optional lead message/notes)
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS message TEXT;

-- Add source column (where the lead came from)
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'website';

-- Add UTM tracking columns (marketing analytics)
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS utm_source TEXT,
ADD COLUMN IF NOT EXISTS utm_medium TEXT,
ADD COLUMN IF NOT EXISTS utm_campaign TEXT;

-- Add metadata column (flexible JSON storage for additional data)
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_source ON public.leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_utm_source ON public.leads(utm_source) WHERE utm_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_metadata ON public.leads USING gin(metadata);

-- Add comments for documentation
COMMENT ON COLUMN public.leads.email IS 'Optional email address for lead contact';
COMMENT ON COLUMN public.leads.message IS 'Optional message or notes from the lead';
COMMENT ON COLUMN public.leads.source IS 'Source of the lead (e.g., website, facebook, google)';
COMMENT ON COLUMN public.leads.utm_source IS 'UTM source for marketing tracking';
COMMENT ON COLUMN public.leads.utm_medium IS 'UTM medium for marketing tracking';
COMMENT ON COLUMN public.leads.utm_campaign IS 'UTM campaign for marketing tracking';
COMMENT ON COLUMN public.leads.metadata IS 'Additional JSON data for the lead (calculator results, etc.)';

