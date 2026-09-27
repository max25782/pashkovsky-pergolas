-- Migration: Add support for complex pergola shapes (L, X, U)
-- Date: 2025-01-20

-- Add pergola shape type column
ALTER TABLE offers 
ADD COLUMN IF NOT EXISTS pergola_shape_type TEXT 
  CHECK (pergola_shape_type IN ('rectangle', 'L', 'X', 'U')) 
  DEFAULT 'rectangle';

-- Add JSONB column for shape data
ALTER TABLE offers 
ADD COLUMN IF NOT EXISTS pergola_shape_data JSONB;

-- Migrate existing data to new format
UPDATE offers 
SET 
  pergola_shape_type = 'rectangle',
  pergola_shape_data = jsonb_build_object(
    'type', 'rectangle',
    'width', pergola_width,
    'length', pergola_length
  )
WHERE pergola_shape_data IS NULL 
  AND pergola_width IS NOT NULL 
  AND pergola_length IS NOT NULL;

-- Create index for faster queries by shape type
CREATE INDEX IF NOT EXISTS idx_offers_pergola_shape_type 
ON offers(pergola_shape_type);

-- Create index for JSONB queries (optional, for advanced filtering)
CREATE INDEX IF NOT EXISTS idx_offers_pergola_shape_data 
ON offers USING GIN (pergola_shape_data);

-- Add comments for documentation
COMMENT ON COLUMN offers.pergola_shape_type IS 'Тип формы перголы: rectangle (прямоугольная), L (Г-образная), X (Х-образная), U (П-образная)';
COMMENT ON COLUMN offers.pergola_shape_data IS 'JSON данные формы перголы. Для rectangle: {type, width, length}. Для L: {type, leg1: {width, length}, leg2: {width, length}, overlap?: {width, length}}. Для X: {type, center: {width, length}, arms: [{direction, width, length}]}. Для U: {type, base: {width, length}, leftLeg: {width, length}, rightLeg: {width, length}}';

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE '✅ Migration 011_add_pergola_shapes completed successfully';
  RAISE NOTICE '📋 Existing offers migrated to rectangle format';
  RAISE NOTICE '🎯 New shape types: L, X, U are now available';
END $$;



