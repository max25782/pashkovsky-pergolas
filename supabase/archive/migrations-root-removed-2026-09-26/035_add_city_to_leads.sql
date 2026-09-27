-- Add city column to leads table for Zapier/Facebook Lead Ads
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS city TEXT;

COMMENT ON COLUMN public.leads.city IS 'Lead city from form or Facebook Lead Ads';
