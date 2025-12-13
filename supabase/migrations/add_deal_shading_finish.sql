-- Add shading and finish fields to deals
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS shading_ratio TEXT CHECK (shading_ratio IN ('40/20','50/20','70/20')) ,
  ADD COLUMN IF NOT EXISTS finish_type TEXT CHECK (finish_type IN ('ral','wood')),
  ADD COLUMN IF NOT EXISTS finish_value TEXT;

-- No RLS changes (table already under existing policies)



