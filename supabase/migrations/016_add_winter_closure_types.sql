-- Add new winter closure types
-- סגירת חורף - הוספת סוגים חדשים

-- Drop existing constraint
ALTER TABLE offers 
DROP CONSTRAINT IF EXISTS offers_winter_closure_type_check;

-- Add new constraint with all types
ALTER TABLE offers 
ADD CONSTRAINT offers_winter_closure_type_check 
CHECK (winter_closure_type IN (
  'foldingGlass',          -- זכוכית מתקפלת
  'windows7000',           -- חלונות 7000 (950 ₪/מ"ר)
  'windows9000',           -- חלונות 9000 (1,050 ₪/מ"ר)
  'fixedGlass',            -- זכוכית קבועה (750 ₪/מ"ר)
  'slidingShowcase7000',   -- ויטרינה הזזה דגם 7000 (1,200 ₪/מ"ר)
  'slidingShowcase9000'    -- ויטרינה הזזה דגם 9000 (1,800 ₪/מ"ר)
));

-- Add winter closure pricing columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'offers' 
    AND column_name = 'winter_closure_price_per_sqm'
  ) THEN
    ALTER TABLE offers 
    ADD COLUMN winter_closure_price_per_sqm NUMERIC(10, 2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'offers' 
    AND column_name = 'winter_closure_area'
  ) THEN
    ALTER TABLE offers 
    ADD COLUMN winter_closure_area NUMERIC(10, 2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'offers' 
    AND column_name = 'winter_closure_total'
  ) THEN
    ALTER TABLE offers 
    ADD COLUMN winter_closure_total NUMERIC(10, 2) DEFAULT 0;
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN offers.winter_closure_type IS 'Winter closure type: foldingGlass, windows7000 (950), windows9000 (1050), fixedGlass (750), slidingShowcase7000 (1200), slidingShowcase9000 (1800)';
COMMENT ON COLUMN offers.winter_closure_price_per_sqm IS 'Price per square meter for winter closure (₪/מ"ר)';
COMMENT ON COLUMN offers.winter_closure_area IS 'Winter closure area in square meters (מ"ר)';
COMMENT ON COLUMN offers.winter_closure_total IS 'Total winter closure price (winter_closure_price_per_sqm * winter_closure_area)';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_offers_winter_closure_enabled 
ON offers(winter_closure_enabled) 
WHERE winter_closure_enabled = true;

