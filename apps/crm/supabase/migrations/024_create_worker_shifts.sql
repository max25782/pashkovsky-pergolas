-- Create worker_shifts table for timesheet tracking (start/end time per worker per day)
CREATE TABLE IF NOT EXISTS public.worker_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE RESTRICT,
  deal_id UUID NULL REFERENCES public.deals(id) ON DELETE SET NULL,
  shift_date DATE NOT NULL,
  start_time TIME NULL,
  end_time TIME NULL,
  minutes_worked INT NULL,
  computed_cost NUMERIC(10, 2) NULL,
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, worker_id, shift_date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_worker_shifts_company_date ON public.worker_shifts(company_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_worker_shifts_company_worker ON public.worker_shifts(company_id, worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_shifts_deal ON public.worker_shifts(deal_id) WHERE deal_id IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER update_worker_shifts_updated_at
  BEFORE UPDATE ON public.worker_shifts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.worker_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can do everything on worker_shifts"
  ON public.worker_shifts
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users access own company worker_shifts" ON public.worker_shifts
  FOR ALL USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  ) WITH CHECK (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

COMMENT ON TABLE public.worker_shifts IS 'Worker timesheets with start/end time, linked to deals';
