-- Create workers table
CREATE TABLE IF NOT EXISTS public.workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  role TEXT,
  daily_rate NUMERIC(10, 2) NOT NULL CHECK (daily_rate > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create work_shifts table
CREATE TABLE IF NOT EXISTS public.work_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE RESTRICT,
  date DATE NOT NULL,
  pay_type TEXT NOT NULL DEFAULT 'daily' CHECK (pay_type = 'daily'),
  daily_rate_snapshot NUMERIC(10, 2) NOT NULL CHECK (daily_rate_snapshot > 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, worker_id, date) -- One worker per day per project
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_work_shifts_project_id ON public.work_shifts(project_id);
CREATE INDEX IF NOT EXISTS idx_work_shifts_worker_id ON public.work_shifts(worker_id);
CREATE INDEX IF NOT EXISTS idx_work_shifts_date ON public.work_shifts(date);
CREATE INDEX IF NOT EXISTS idx_work_shifts_project_date ON public.work_shifts(project_id, date);
CREATE INDEX IF NOT EXISTS idx_workers_is_active ON public.workers(is_active);

-- Create updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_workers_updated_at
  BEFORE UPDATE ON public.workers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_work_shifts_updated_at
  BEFORE UPDATE ON public.work_shifts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_shifts ENABLE ROW LEVEL SECURITY;

-- Workers: Service role can do everything
CREATE POLICY "Service role can do everything on workers"
  ON public.workers
  FOR ALL
  USING (auth.role() = 'service_role');

-- Work shifts: Service role can do everything
CREATE POLICY "Service role can do everything on work_shifts"
  ON public.work_shifts
  FOR ALL
  USING (auth.role() = 'service_role');

-- Add comments
COMMENT ON TABLE public.workers IS 'Workers/employees with daily rates';
COMMENT ON TABLE public.work_shifts IS 'Work shifts/logs for projects';
COMMENT ON COLUMN public.work_shifts.daily_rate_snapshot IS 'Snapshot of worker daily rate at the time of shift (important for historical accuracy)';


