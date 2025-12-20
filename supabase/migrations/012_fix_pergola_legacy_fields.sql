-- Migration: Make legacy pergola fields nullable since we use shape_data now
-- Date: 2025-01-20
-- Reason: pergola_width and pergola_length should be NULL for non-rectangle shapes (L, X, U)

-- Make pergola_width and pergola_length nullable (they're legacy fields now)
ALTER TABLE offers 
ALTER COLUMN pergola_width DROP NOT NULL;

ALTER TABLE offers 
ALTER COLUMN pergola_length DROP NOT NULL;

-- Add comment to clarify these are legacy fields
COMMENT ON COLUMN offers.pergola_width IS 'Legacy field: Width for rectangle shapes only. Use pergola_shape_data for all shapes. NULL for L, X, U shapes.';
COMMENT ON COLUMN offers.pergola_length IS 'Legacy field: Length for rectangle shapes only. Use pergola_shape_data for all shapes. NULL for L, X, U shapes.';

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE '✅ Migration 012_fix_pergola_legacy_fields completed';
  RAISE NOTICE '📋 pergola_width and pergola_length are now nullable';
  RAISE NOTICE '🎯 Use pergola_shape_data for all shape types';
END $$;

