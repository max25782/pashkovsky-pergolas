-- Deleting a worker should remove timesheet rows (worker_shifts), not fail on FK.
ALTER TABLE public.worker_shifts
  DROP CONSTRAINT IF EXISTS worker_shifts_worker_id_fkey;

ALTER TABLE public.worker_shifts
  ADD CONSTRAINT worker_shifts_worker_id_fkey
  FOREIGN KEY (worker_id) REFERENCES public.workers(id) ON DELETE CASCADE;
