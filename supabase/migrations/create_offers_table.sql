-- Create offers table
CREATE TABLE IF NOT EXISTS public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  
  -- Pergola dimensions
  width NUMERIC(10, 2) NOT NULL,
  length NUMERIC(10, 2) NOT NULL,
  height NUMERIC(10, 2),
  
  -- Pergola pricing
  pergola_price_per_sqm NUMERIC(10, 2) NOT NULL DEFAULT 750,
  
  -- Santaf
  santaf_enabled BOOLEAN NOT NULL DEFAULT false,
  santaf_type TEXT NOT NULL DEFAULT 'basic' CHECK (santaf_type IN ('basic', 'withStructure')),
  santaf_basic_price_per_sqm NUMERIC(10, 2) NOT NULL DEFAULT 220,
  santaf_with_structure_price_per_sqm NUMERIC(10, 2) NOT NULL DEFAULT 450,
  
  -- Discount
  discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  
  -- Calculated values
  area NUMERIC(10, 2) NOT NULL,
  pergola_total NUMERIC(10, 2) NOT NULL,
  santaf_total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_before_vat NUMERIC(10, 2) NOT NULL,
  vat_amount NUMERIC(10, 2) NOT NULL,
  price_with_vat NUMERIC(10, 2) NOT NULL,
  discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  final_price NUMERIC(10, 2) NOT NULL,
  
  -- Approval (for future use)
  approved BOOLEAN NOT NULL DEFAULT false,
  approved_at TIMESTAMPTZ,
  signature_image TEXT,
  
  -- PDF
  pdf_url TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index on deal_id for faster queries
CREATE INDEX IF NOT EXISTS idx_offers_deal_id ON public.offers(deal_id);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_offers_created_at ON public.offers(created_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for service role
CREATE POLICY "Service role can do everything on offers"
  ON public.offers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Allow authenticated users to read all offers
CREATE POLICY "Authenticated users can read offers"
  ON public.offers
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Allow authenticated users to create offers
CREATE POLICY "Authenticated users can create offers"
  ON public.offers
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Allow authenticated users to update offers
CREATE POLICY "Authenticated users can update offers"
  ON public.offers
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_offers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_offers_updated_at_trigger
  BEFORE UPDATE ON public.offers
  FOR EACH ROW
  EXECUTE FUNCTION update_offers_updated_at();

-- Add comment
COMMENT ON TABLE public.offers IS 'Offers (הצעות מחיר) for clients';

