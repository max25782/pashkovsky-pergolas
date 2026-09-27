-- Legacy project work logs (work_shifts) also reference workers; allow worker delete to cascade.
ALTER TABLE public.work_shifts
  DROP CONSTRAINT IF EXISTS work_shifts_worker_id_fkey;

ALTER TABLE public.work_shifts
  ADD CONSTRAINT work_shifts_worker_id_fkey
  FOREIGN KEY (worker_id) REFERENCES public.workers(id) ON DELETE CASCADE;
