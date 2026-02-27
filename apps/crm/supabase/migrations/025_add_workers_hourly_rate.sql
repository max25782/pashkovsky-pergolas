-- Add optional hourly_rate to workers for cost calculation
ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10, 2) NULL;

COMMENT ON COLUMN public.workers.hourly_rate IS 'Optional hourly rate; if set, used for shift cost instead of daily_rate * (hours/9)';
