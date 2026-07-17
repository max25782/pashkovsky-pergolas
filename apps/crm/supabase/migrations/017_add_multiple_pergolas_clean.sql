ALTER TABLE offers ADD COLUMN pergolas_data JSONB;

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

CREATE INDEX IF NOT EXISTS idx_offers_pergolas_data 
ON offers USING GIN (pergolas_data);

COMMENT ON COLUMN offers.pergolas_data IS 'JSONB array of pergola objects. Each pergola has: {shape: PergolaShape, height?: number, location?: string, pricePerSqm: number}. Supports multiple pergolas in one offer.';
