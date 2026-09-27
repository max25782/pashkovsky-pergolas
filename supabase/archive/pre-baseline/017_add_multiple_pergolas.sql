-- Migration: Add support for multiple pergolas in one offer
-- Date: 2025-01-27

-- Add JSONB column for array of pergolas
ALTER TABLE offers 
ADD COLUMN IF NOT EXISTS pergolas_data JSONB;

-- Migrate existing single pergola to array format for backward compatibility
UPDATE offers 
SET pergolas_data = jsonb_build_array(
  jsonb_build_object(
    'shape', COALESCE(pergola_shape_data, jsonb_build_object(
      'type', 'rectangle',
      'width', COALESCE(pergola_width, 0),
      'length', COALESCE(pergola_length, 0)
    )),
    'height', pergola_height,
    'location', pergola_location,
    'pricePerSqm', COALESCE(pergola_price_per_sqm, 750)
  )
)
WHERE pergolas_data IS NULL 
  AND (pergola_shape_data IS NOT NULL OR pergola_width IS NOT NULL);

-- Create index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_offers_pergolas_data 
ON offers USING GIN (pergolas_data);

-- Add comment for documentation
COMMENT ON COLUMN offers.pergolas_data IS 'JSONB array of pergola objects. Each pergola has: {shape: PergolaShape, height?: number, location?: string, pricePerSqm: number}. Supports multiple pergolas in one offer.';

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE 'Migration 017_add_multiple_pergolas completed successfully';
  RAISE NOTICE 'Existing single pergolas migrated to array format';
  RAISE NOTICE 'Multiple pergolas per offer are now supported';
END $$;
