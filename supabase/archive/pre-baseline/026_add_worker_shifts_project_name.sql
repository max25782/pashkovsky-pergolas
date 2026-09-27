-- Allow custom project/deal text when no deal is linked
ALTER TABLE public.worker_shifts
  ADD COLUMN IF NOT EXISTS project_name TEXT NULL;

COMMENT ON COLUMN public.worker_shifts.project_name IS 'Custom project/deal name when deal_id is null';
