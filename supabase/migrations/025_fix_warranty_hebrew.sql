-- Migration 025: Fix warranty language to Hebrew
-- Changes default warranty values from English to Hebrew

-- Update default value for warranty column (for new records)
ALTER TABLE offers 
ALTER COLUMN warranty 
SET DEFAULT '{"years": 7, "covers": ["צבע", "קונסטרוקציה", "סנטף"]}'::jsonb;

-- Update all existing offers to use Hebrew warranty terms
UPDATE offers
SET warranty = jsonb_build_object(
  'years', COALESCE((warranty->>'years')::int, 7),
  'covers', jsonb_build_array('צבע', 'קונסטרוקציה', 'סנטף')
)
WHERE warranty IS NOT NULL;

-- Verify
SELECT 
  'Migration completed!' as status,
  COUNT(*) as total_offers,
  COUNT(CASE WHEN warranty->'covers' @> '["צבע"]'::jsonb THEN 1 END) as hebrew_warranty
FROM offers;

