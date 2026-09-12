-- Verify Pashkovsky Company ID
-- Run this in Supabase SQL Editor to confirm

SELECT 
  id,
  name,
  slug,
  created_at
FROM companies 
WHERE id = '6998295e-89ae-4e3d-afd2-8c2b0333eac2';

-- Expected result:
-- id: 6998295e-89ae-4e3d-afd2-8c2b0333eac2
-- name: Pashkovsky Group (or similar)
-- slug: pashkovsky-group (or similar)
