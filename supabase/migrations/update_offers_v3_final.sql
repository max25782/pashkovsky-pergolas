-- Drop old offers table if exists
DROP TABLE IF EXISTS public.offers CASCADE;

-- Create new offers table with FULL updated structure
CREATE TABLE public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_city TEXT,
  
  -- Pergola data (with editable price per sqm)
  pergola_width NUMERIC(10, 2) NOT NULL,
  pergola_length NUMERIC(10, 2) NOT NULL,
  pergola_height NUMERIC(10, 2),
  pergola_location TEXT,
  pergola_price_per_sqm NUMERIC(10, 2) NOT NULL DEFAULT 750,
  
  -- Color
  color_type TEXT NOT NULL CHECK (color_type IN ('white', 'black', 'cream', 'ral', 'wood')),
  color_ral_code TEXT,
  color_wood_name TEXT,
  
  -- Roof
  roof_type TEXT CHECK (roof_type IN ('santaf', 'triplexGlass')),
  roof_santaf_color TEXT CHECK (roof_santaf_color IN ('transparent', 'gray', 'white', 'gold')),
  
  -- Santaf (with editable prices)
  santaf_enabled BOOLEAN NOT NULL DEFAULT false,
  santaf_with_structure BOOLEAN NOT NULL DEFAULT false,
  santaf_price_per_sqm_basic NUMERIC(10, 2) NOT NULL DEFAULT 220,
  santaf_price_per_sqm_with_structure NUMERIC(10, 2) NOT NULL DEFAULT 450,
  
  -- ZIP Screen
  zip_screen_enabled BOOLEAN NOT NULL DEFAULT false,
  zip_screen_type TEXT CHECK (zip_screen_type IN ('manual', 'electric')),
  zip_screen_price_per_sqm_manual NUMERIC(10, 2) NOT NULL DEFAULT 650,
  zip_screen_price_per_sqm_electric NUMERIC(10, 2) NOT NULL DEFAULT 800,
  zip_screen_running_meters NUMERIC(10, 2),
  
  -- Lighting (תאורה) - NEW!
  lighting_enabled BOOLEAN NOT NULL DEFAULT false,
  lighting_price_per_meter NUMERIC(10, 2) NOT NULL DEFAULT 200,
  lighting_running_meters NUMERIC(10, 2),
  
  -- Drainage (ניקוז) - NEW!
  drainage_enabled BOOLEAN NOT NULL DEFAULT false,
  drainage_price_per_meter NUMERIC(10, 2) NOT NULL DEFAULT 500,
  drainage_running_meters NUMERIC(10, 2),
  
  -- Winter Closure (glass)
  winter_closure_enabled BOOLEAN NOT NULL DEFAULT false,
  winter_closure_type TEXT CHECK (winter_closure_type IN ('foldingGlass', 'windows7000', 'windows9000')),
  winter_closure_glass_type TEXT CHECK (winter_closure_glass_type IN ('tempered', 'triplex', 'insulated')),
  
  -- Options (notes only)
  options_notes TEXT,
  
  -- Calculated values
  area NUMERIC(10, 2) NOT NULL,
  pergola_total NUMERIC(10, 2) NOT NULL,
  santaf_total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  zip_screen_total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  lighting_total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  drainage_total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  
  -- Pricing (FORMULA: discount applied AFTER VAT)
  total_before_vat NUMERIC(10, 2) NOT NULL,
  vat_percent NUMERIC(5, 2) NOT NULL DEFAULT 18,
  vat_amount NUMERIC(10, 2) NOT NULL,
  price_with_vat NUMERIC(10, 2) NOT NULL,
  
  discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  
  final_price NUMERIC(10, 2) NOT NULL,
  
  -- Payment terms
  payment_terms JSONB NOT NULL DEFAULT '{"advancePercent": 10, "remainingPercent": 90, "method": "bankTransfer", "text": "10% מקדמה וכל השאר בסיום התקנה בהעברה בנקאית"}'::jsonb,
  
  -- Warranty
  warranty JSONB NOT NULL DEFAULT '{"years": 7, "covers": ["color", "construction", "santaf"]}'::jsonb,
  
  -- Images
  images TEXT[],
  
  -- Approval
  approved BOOLEAN NOT NULL DEFAULT false,
  approved_at TIMESTAMPTZ,
  signature_image TEXT,
  approval_customer_name TEXT,
  approval_customer_phone TEXT,
  
  -- PDF
  pdf_url TEXT,
  pdf_created_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_offers_deal_id ON public.offers(deal_id);
CREATE INDEX idx_offers_created_at ON public.offers(created_at DESC);
CREATE INDEX idx_offers_approved ON public.offers(approved);

-- Enable RLS
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything
CREATE POLICY "Service role can do everything on offers"
  ON public.offers FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Policy: Authenticated users can read all offers
CREATE POLICY "Authenticated users can read offers"
  ON public.offers FOR SELECT TO authenticated
  USING (true);

-- Policy: Authenticated users can create offers
CREATE POLICY "Authenticated users can create offers"
  ON public.offers FOR INSERT TO authenticated
  WITH CHECK (true);

-- Policy: Authenticated users can update offers
CREATE POLICY "Authenticated users can update offers"
  ON public.offers FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- Policy: Public can read offers (for client approval page)
CREATE POLICY "Public can read offers"
  ON public.offers FOR SELECT TO anon
  USING (true);

-- Policy: Public can update approval fields (for client signature)
CREATE POLICY "Public can approve offers"
  ON public.offers FOR UPDATE TO anon
  USING (true)
  WITH CHECK (approved = true);

-- Trigger function
CREATE OR REPLACE FUNCTION update_offers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
CREATE TRIGGER update_offers_updated_at_trigger
  BEFORE UPDATE ON public.offers
  FOR EACH ROW
  EXECUTE FUNCTION update_offers_updated_at();

-- Comment
COMMENT ON TABLE public.offers IS 'Complete offers with pergola, santaf, ZIP, lighting (200₪/m), drainage (500₪/m), pricing (discount after VAT 18%)';

