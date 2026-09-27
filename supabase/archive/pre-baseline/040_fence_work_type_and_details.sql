-- Fence as work type + per-deal fence details; railings glazing system (aluminum+glass / wet / dry)

-- A) work_type includes fence
ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_work_type_check;
ALTER TABLE public.deals ADD CONSTRAINT deals_work_type_check
  CHECK (work_type IN ('pergola', 'railings', 'gates', 'facade', 'fence', 'other'));

-- B) deal_fence_details (1:1 with deals, mirrors deal_railings_details pattern)
CREATE TABLE IF NOT EXISTS public.deal_fence_details (
  deal_id UUID PRIMARY KEY REFERENCES public.deals(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  meters_total NUMERIC(10,2) NOT NULL CHECK (meters_total > 0),
  height_cm NUMERIC(10,2) NULL,
  fence_variant TEXT NOT NULL CHECK (fence_variant IN ('classic', 'hitech', 'hitech_angular')),
  color TEXT NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_fence_company_created
  ON public.deal_fence_details(company_id, created_at);

DROP TRIGGER IF EXISTS update_deal_fence_updated_at ON public.deal_fence_details;
CREATE TRIGGER update_deal_fence_updated_at
  BEFORE UPDATE ON public.deal_fence_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.deal_fence_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can do everything on deal_fence_details"
  ON public.deal_fence_details
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users access own company deal_fence_details" ON public.deal_fence_details
  FOR ALL USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  ) WITH CHECK (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

COMMENT ON TABLE public.deal_fence_details IS 'Fence line items: variant (classic / hitech / angular), meters, color';

-- C) Railings: glazing system (aluminum + glass vs wet vs dry glazing)
ALTER TABLE public.deal_railings_details
  ADD COLUMN IF NOT EXISTS glazing_system TEXT NULL;

ALTER TABLE public.deal_railings_details
  DROP CONSTRAINT IF EXISTS deal_railings_details_glazing_system_check;

ALTER TABLE public.deal_railings_details
  ADD CONSTRAINT deal_railings_details_glazing_system_check
  CHECK (
    glazing_system IS NULL
    OR glazing_system IN ('aluminum_glass', 'wet_glazing', 'dry_glazing')
  );

COMMENT ON COLUMN public.deal_railings_details.glazing_system IS 'aluminum_glass | wet_glazing | dry_glazing';
