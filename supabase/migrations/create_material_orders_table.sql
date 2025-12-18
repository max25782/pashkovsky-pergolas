-- Create material_orders table (חומר הוזמן)
-- This table tracks when materials are ordered for a deal

CREATE TABLE IF NOT EXISTS public.material_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id TEXT NOT NULL,
  offer_id UUID REFERENCES public.offers(id) ON DELETE SET NULL,
  
  -- Material details
  material_type TEXT NOT NULL, -- e.g., 'aluminum', 'glass', 'santaf', etc.
  material_description TEXT,
  quantity NUMERIC(10, 2),
  unit TEXT DEFAULT 'pcs', -- 'pcs', 'sqm', 'meters', etc.
  
  -- Supplier information
  supplier_name TEXT,
  supplier_contact TEXT,
  supplier_email TEXT,
  supplier_phone TEXT,
  
  -- Order details
  order_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expected_delivery_date TIMESTAMPTZ,
  actual_delivery_date TIMESTAMPTZ,
  
  -- Financial
  unit_price NUMERIC(10, 2),
  total_price NUMERIC(10, 2),
  currency TEXT DEFAULT 'ILS',
  
  -- Status
  status TEXT NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered', 'confirmed', 'in_transit', 'delivered', 'cancelled')),
  
  -- Tracking
  tracking_number TEXT,
  tracking_url TEXT,
  
  -- Notes
  notes TEXT,
  internal_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_material_orders_deal_id ON public.material_orders(deal_id);
CREATE INDEX IF NOT EXISTS idx_material_orders_offer_id ON public.material_orders(offer_id);
CREATE INDEX IF NOT EXISTS idx_material_orders_status ON public.material_orders(status);
CREATE INDEX IF NOT EXISTS idx_material_orders_order_date ON public.material_orders(order_date DESC);

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION update_material_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_material_orders_updated_at_trigger
  BEFORE UPDATE ON public.material_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_material_orders_updated_at();

-- Enable RLS
ALTER TABLE public.material_orders ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything
CREATE POLICY "Service role can do everything on material_orders"
  ON public.material_orders FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Policy: Authenticated users can read all material orders
CREATE POLICY "Authenticated users can read material_orders"
  ON public.material_orders FOR SELECT TO authenticated
  USING (true);

-- Policy: Authenticated users can create material orders
CREATE POLICY "Authenticated users can create material_orders"
  ON public.material_orders FOR INSERT TO authenticated
  WITH CHECK (true);

-- Policy: Authenticated users can update material orders
CREATE POLICY "Authenticated users can update material_orders"
  ON public.material_orders FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- Comment
COMMENT ON TABLE public.material_orders IS 'Material orders (חומר הוזמן) - tracks when materials are ordered for deals';

