-- A) Add work_type to deals
ALTER TABLE public.deals 
  ADD COLUMN IF NOT EXISTS work_type TEXT NOT NULL DEFAULT 'pergola' 
  CHECK (work_type IN ('pergola', 'railings', 'other'));

-- B) Create deal_railings_details (1:1 with deals)
CREATE TABLE IF NOT EXISTS public.deal_railings_details (
  deal_id UUID PRIMARY KEY REFERENCES public.deals(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  meters_total NUMERIC(10,2) NOT NULL CHECK(meters_total > 0),
  height_cm NUMERIC(10,2) NULL,
  profile_type TEXT NOT NULL,
  color TEXT NOT NULL,
  location_type TEXT NOT NULL CHECK(location_type IN ('balcony', 'stairs', 'roof', 'yard', 'other')),
  glass_type TEXT NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_railings_company_created 
  ON public.deal_railings_details(company_id, created_at);

CREATE TRIGGER update_deal_railings_updated_at
  BEFORE UPDATE ON public.deal_railings_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- C) Create deal_payments (for cumulative widget)
CREATE TABLE IF NOT EXISTS public.deal_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK(amount > 0),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_payments_deal ON public.deal_payments(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_payments_company_paid ON public.deal_payments(company_id, paid_at);

-- D) RLS on deal_railings_details
ALTER TABLE public.deal_railings_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own company railings" ON public.deal_railings_details
  FOR ALL USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  ) WITH CHECK (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

-- E) RLS on deal_payments
ALTER TABLE public.deal_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own company payments" ON public.deal_payments
  FOR ALL USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  ) WITH CHECK (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );
