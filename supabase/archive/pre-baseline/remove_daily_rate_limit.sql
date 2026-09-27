-- Remove CHECK constraint on daily_rate to allow any positive value
-- Run this migration if the table already exists with the old constraint

ALTER TABLE public.workers 
DROP CONSTRAINT IF EXISTS workers_daily_rate_check;

ALTER TABLE public.workers 
ADD CONSTRAINT workers_daily_rate_check CHECK (daily_rate > 0);





