-- Add laundry closet fields to deals table
ALTER TABLE public.deals 
ADD COLUMN IF NOT EXISTS laundry_model TEXT,
ADD COLUMN IF NOT EXISTS laundry_distance NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS laundry_lighting BOOLEAN;

-- Update project_type constraint to include 'laundry_closet'
-- Note: If there's a CHECK constraint, you may need to drop and recreate it
-- For now, we'll just add the column values

-- Add index for laundry closet queries
CREATE INDEX IF NOT EXISTS idx_deals_laundry_closet ON public.deals(project_type) WHERE project_type = 'laundry_closet';

