-- Add lead scoring fields to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS score INTEGER CHECK (score >= 0 AND score <= 100),
ADD COLUMN IF NOT EXISTS score_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS score_breakdown_json JSONB DEFAULT '{}'::jsonb;

-- Create index for score queries
CREATE INDEX IF NOT EXISTS idx_leads_score ON public.leads(score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_score_updated_at ON public.leads(score_updated_at DESC);

-- Create index for score filtering
CREATE INDEX IF NOT EXISTS idx_leads_score_range ON public.leads(score) WHERE score IS NOT NULL;

