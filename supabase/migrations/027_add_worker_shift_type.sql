-- Add shift_type to worker_shifts to support holiday and day-off entries
ALTER TABLE public.worker_shifts
  ADD COLUMN IF NOT EXISTS shift_type TEXT NOT NULL DEFAULT 'work'
    CHECK (shift_type IN ('work', 'holiday', 'day_off'));

COMMENT ON COLUMN public.worker_shifts.shift_type IS 'Type of entry: work (regular shift), holiday (חג), day_off (יום חופש)';

CREATE INDEX IF NOT EXISTS idx_worker_shifts_shift_type ON public.worker_shifts(shift_type) WHERE shift_type != 'work';
