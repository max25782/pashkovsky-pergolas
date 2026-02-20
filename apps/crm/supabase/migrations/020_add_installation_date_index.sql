-- Add index for monthly revenue queries by installation_date
CREATE INDEX IF NOT EXISTS idx_deals_company_installation_date 
  ON public.deals (company_id, installation_date) 
  WHERE installation_date IS NOT NULL;
