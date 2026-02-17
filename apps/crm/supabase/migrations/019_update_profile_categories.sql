-- Migration 019: Update Profile Categories
-- Purpose: Change categories from old values to new ones

-- ============================================
-- 1. DROP OLD CONSTRAINT FIRST
-- ============================================
-- Drop old constraint to allow data updates
ALTER TABLE aluminum_profiles 
DROP CONSTRAINT IF EXISTS aluminum_profiles_category_check;

-- ============================================
-- 2. MIGRATE EXISTING DATA (if any)
-- ============================================
-- Map old categories to new ones BEFORE adding new constraint
UPDATE aluminum_profiles 
SET category = CASE
  WHEN category = 'structural' THEN 'pergulas'
  WHEN category = 'lighting' THEN 'fancy'
  WHEN category = 'decorative' THEN 'fancy'
  WHEN category = 'railings' THEN 'railling'
  ELSE category
END
WHERE category IN ('structural', 'lighting', 'decorative', 'railings');

-- ============================================
-- 3. ADD NEW CHECK CONSTRAINT
-- ============================================
-- Now add new constraint with updated categories
ALTER TABLE aluminum_profiles 
ADD CONSTRAINT aluminum_profiles_category_check 
CHECK (category IN ('pergulas', 'fancy', 'railling', 'concealed', 'window'));

-- ============================================
-- 4. UPDATE COMMENT
-- ============================================
COMMENT ON COLUMN aluminum_profiles.category IS 'Category: pergulas, fancy, railling, concealed (מסתורי כביסהת), window';
