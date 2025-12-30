-- Fix warranty language from English to Hebrew
-- Updates all existing offers to use Hebrew warranty terms

-- Update all existing offers
UPDATE offers
SET warranty = jsonb_build_object(
  'years', (warranty->>'years')::int,
  'covers', jsonb_build_array('צבע', 'קונסטרוקציה', 'סנטף')
)
WHERE warranty IS NOT NULL;

-- Verify the update
SELECT 
  id,
  customer_name,
  warranty
FROM offers
LIMIT 5;

-- Check how many were updated
SELECT 
  COUNT(*) as total_offers,
  COUNT(CASE WHEN warranty->>'covers' LIKE '%צבע%' THEN 1 END) as hebrew_warranty,
  COUNT(CASE WHEN warranty->>'covers' LIKE '%color%' THEN 1 END) as english_warranty
FROM offers;

