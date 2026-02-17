-- Migration: Create Profiles E-Commerce System
-- Date: 2025-02-05
-- Description: Complete aluminum profiles shop system with inventory, orders, and supplier tracking

-- ============================================================================
-- 1. SUPPLIERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  payment_terms TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 2. ALUMINUM_PROFILES TABLE (Product Catalog)
-- ============================================================================
-- Note: Renamed from "profiles" to avoid conflict with existing users table
CREATE TABLE IF NOT EXISTS aluminum_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name_he TEXT,
  name_ru TEXT,
  name_en TEXT,
  dimensions TEXT,
  weight_per_meter NUMERIC NOT NULL,
  available_lengths NUMERIC[] DEFAULT ARRAY[6.0, 6.5, 7.0, 8.0],
  category TEXT CHECK (category IN ('pergulas', 'fancy', 'railling', 'concealed', 'window')),
  description_he TEXT,
  description_ru TEXT,
  description_en TEXT,
  image_url TEXT,
  price_per_kg NUMERIC NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, code)
);

COMMENT ON TABLE aluminum_profiles IS 'Aluminum profiles catalog. Price calculated as: length × weight_per_meter × price_per_kg';
COMMENT ON COLUMN aluminum_profiles.weight_per_meter IS 'Weight in kg per meter (e.g., 0.85)';
COMMENT ON COLUMN aluminum_profiles.price_per_kg IS 'Selling price per kilogram in ₪ (e.g., 120)';
COMMENT ON COLUMN aluminum_profiles.available_lengths IS 'Array of available lengths in meters (e.g., [6.0, 6.5, 7.0, 8.0])';

-- ============================================================================
-- 3. BATCHES TABLE (Supplier Deliveries)
-- ============================================================================
CREATE TABLE IF NOT EXISTS batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id),
  profile_id UUID NOT NULL REFERENCES aluminum_profiles(id) ON DELETE CASCADE,
  color TEXT NOT NULL,
  length_meters NUMERIC NOT NULL,
  quantity_pieces INTEGER NOT NULL CHECK (quantity_pieces > 0),
  weight_kg NUMERIC,
  status TEXT CHECK (status IN ('planned', 'in_transit', 'arrived', 'cancelled')) DEFAULT 'planned',
  planned_arrival_date DATE,
  actual_arrival_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE batches IS 'Supplier deliveries. One delivery can have multiple batches (different lengths)';
COMMENT ON COLUMN batches.weight_kg IS 'Total weight calculated as: quantity_pieces × length_meters × weight_per_meter';

-- ============================================================================
-- 4. STOCK TABLE (Inventory)
-- ============================================================================
CREATE TABLE IF NOT EXISTS stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES aluminum_profiles(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES batches(id),
  color TEXT NOT NULL,
  length_meters NUMERIC NOT NULL,
  qty_available INTEGER NOT NULL DEFAULT 0 CHECK (qty_available >= 0),
  qty_reserved INTEGER NOT NULL DEFAULT 0 CHECK (qty_reserved >= 0),
  qty_used INTEGER NOT NULL DEFAULT 0 CHECK (qty_used >= 0),
  location TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, profile_id, batch_id, color, length_meters)
);

COMMENT ON TABLE stock IS 'Inventory tracking. Separate record for each profile+color+length combination';
COMMENT ON COLUMN stock.qty_available IS 'Pieces currently available for sale';
COMMENT ON COLUMN stock.qty_reserved IS 'Pieces reserved for pending orders';
COMMENT ON COLUMN stock.qty_used IS 'Pieces already sold/used';

-- ============================================================================
-- 5. PROFILE_ORDERS TABLE (Customer Orders)
-- ============================================================================
CREATE TABLE IF NOT EXISTS profile_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  order_number TEXT UNIQUE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  customer_city TEXT,
  status TEXT CHECK (status IN (
    'pending_price',
    'priced',
    'confirmed',
    'preparing',
    'ready',
    'delivered',
    'cancelled'
  )) DEFAULT 'pending_price',
  total_weight_kg NUMERIC,
  total_amount NUMERIC,
  discount_percent NUMERIC DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  discount_amount NUMERIC DEFAULT 0 CHECK (discount_amount >= 0),
  final_amount NUMERIC,
  payment_status TEXT CHECK (payment_status IN ('pending', 'paid', 'refunded')) DEFAULT 'pending',
  delivery_address TEXT,
  delivery_date DATE,
  notes TEXT,
  customer_notes TEXT,
  source TEXT DEFAULT 'website',
  deal_id UUID REFERENCES deals(id),
  priced_at TIMESTAMPTZ,
  priced_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE profile_orders IS 'Customer orders. Status flow: pending_price → priced → confirmed → preparing → ready → delivered';
COMMENT ON COLUMN profile_orders.status IS 'pending_price: waiting for admin to set prices; priced: prices set; confirmed: order confirmed and stock reserved';

-- ============================================================================
-- 6. ORDER_ITEMS TABLE (Order Line Items)
-- ============================================================================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES profile_orders(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES aluminum_profiles(id),
  color TEXT NOT NULL,
  length_meters NUMERIC NOT NULL,
  quantity_pieces INTEGER NOT NULL CHECK (quantity_pieces > 0),
  weight_per_piece NUMERIC NOT NULL,
  total_weight_kg NUMERIC NOT NULL,
  price_per_kg NUMERIC,
  price_per_piece NUMERIC,
  subtotal NUMERIC
);

COMMENT ON TABLE order_items IS 'Order line items. Prices are NULL initially, set by admin in CRM';
COMMENT ON COLUMN order_items.weight_per_piece IS 'Calculated as: length_meters × weight_per_meter from profile';
COMMENT ON COLUMN order_items.total_weight_kg IS 'Calculated as: weight_per_piece × quantity_pieces';

-- ============================================================================
-- 7. USAGE TABLE (Supplier Billing Tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES batches(id),
  profile_id UUID NOT NULL REFERENCES aluminum_profiles(id),
  order_id UUID REFERENCES profile_orders(id),
  color TEXT NOT NULL,
  length_meters NUMERIC NOT NULL,
  quantity_pieces INTEGER NOT NULL CHECK (quantity_pieces > 0),
  weight_kg NUMERIC NOT NULL,
  used_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

COMMENT ON TABLE usage IS 'Usage tracking for supplier billing. NO PRICES - only quantities and weight';
COMMENT ON COLUMN usage.weight_kg IS 'Total weight: quantity_pieces × length_meters × weight_per_meter';

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_aluminum_profiles_company_active ON aluminum_profiles(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_aluminum_profiles_code ON aluminum_profiles(code);
CREATE INDEX IF NOT EXISTS idx_batches_company_status ON batches(company_id, status, planned_arrival_date);
CREATE INDEX IF NOT EXISTS idx_batches_profile ON batches(profile_id);
CREATE INDEX IF NOT EXISTS idx_stock_company_profile ON stock(company_id, profile_id, color, length_meters);
CREATE INDEX IF NOT EXISTS idx_stock_available ON stock(company_id) WHERE qty_available > 0;
CREATE INDEX IF NOT EXISTS idx_orders_company_status ON profile_orders(company_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_number ON profile_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_usage_company_batch_date ON usage(company_id, batch_id, used_at);
CREATE INDEX IF NOT EXISTS idx_usage_order ON usage(order_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_company ON suppliers(company_id, is_active);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE aluminum_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- Aluminum Profiles: Public can view active profiles (for storefront), users manage own company
CREATE POLICY "Public view active aluminum profiles" ON aluminum_profiles
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Users manage own company aluminum profiles" ON aluminum_profiles
  USING (company_id = (auth.jwt() ->> 'company_id')::uuid);

-- Batches: Users access own company only
CREATE POLICY "Users access own company batches" ON batches
  USING (company_id = (auth.jwt() ->> 'company_id')::uuid);

-- Stock: Users access own company only
CREATE POLICY "Users access own company stock" ON stock
  USING (company_id = (auth.jwt() ->> 'company_id')::uuid);

-- Orders: Users access own company only
CREATE POLICY "Users access own company orders" ON profile_orders
  USING (company_id = (auth.jwt() ->> 'company_id')::uuid);

-- Order items: Inherit from parent order
CREATE POLICY "Users access order items via orders" ON order_items
  USING (
    EXISTS (
      SELECT 1 FROM profile_orders
      WHERE profile_orders.id = order_items.order_id
      AND profile_orders.company_id = (auth.jwt() ->> 'company_id')::uuid
    )
  );

-- Usage: Users access own company only
CREATE POLICY "Users access own company usage" ON usage
  USING (company_id = (auth.jwt() ->> 'company_id')::uuid);

-- Suppliers: Users access own company only
CREATE POLICY "Users access own company suppliers" ON suppliers
  USING (company_id = (auth.jwt() ->> 'company_id')::uuid);

-- ============================================================================
-- AUTO-GENERATE ORDER NUMBERS
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS order_number_seq;

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := 'PO-' || TO_CHAR(NEW.created_at, 'YYYYMMDD') || '-' || 
      LPAD(NEXTVAL('order_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number
  BEFORE INSERT ON profile_orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_order_number();

-- ============================================================================
-- AUTO-UPDATE TIMESTAMPS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_aluminum_profiles_updated_at BEFORE UPDATE ON aluminum_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_batches_updated_at BEFORE UPDATE ON batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stock_updated_at BEFORE UPDATE ON stock
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON profile_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$ 
BEGIN 
  RAISE NOTICE '✓ Migration 018_create_profiles_system completed successfully';
  RAISE NOTICE '✓ Created 7 tables: suppliers, profiles, batches, stock, profile_orders, order_items, usage';
  RAISE NOTICE '✓ Indexes created for performance';
  RAISE NOTICE '✓ RLS policies enabled for multi-tenancy';
  RAISE NOTICE '✓ Triggers set up for auto-generation';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Apply this migration in Supabase SQL Editor';
  RAISE NOTICE '2. Initialize NestJS API';
  RAISE NOTICE '3. Implement profiles module';
END $$;
