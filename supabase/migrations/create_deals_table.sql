-- Create deals table for closed leads (won status)
-- This is a more complex table with many components for the advanced CRM

CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  
  -- Basic information from lead
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  customer_city TEXT,
  
  -- Deal information
  deal_status TEXT NOT NULL DEFAULT 'in_progress' CHECK (deal_status IN ('in_progress', 'confirmed', 'in_production', 'completed', 'cancelled')),
  deal_type TEXT, -- e.g., 'pergola', 'railing', 'fence', etc.
  project_address TEXT,
  project_description TEXT,
  
  -- Financial information
  total_amount DECIMAL(10, 2),
  deposit_amount DECIMAL(10, 2),
  final_amount DECIMAL(10, 2),
  currency TEXT DEFAULT 'ILS',
  payment_status TEXT CHECK (payment_status IN ('pending', 'partial', 'paid', 'refunded')),
  
  -- Dates
  deal_date TIMESTAMPTZ DEFAULT NOW(),
  confirmed_date TIMESTAMPTZ,
  production_start_date TIMESTAMPTZ,
  completion_date TIMESTAMPTZ,
  delivery_date TIMESTAMPTZ,
  installation_date TIMESTAMPTZ,
  
  -- Project details
  project_config JSONB, -- Store pergola config, dimensions, etc.
  materials JSONB, -- Store materials list
  measurements JSONB, -- Store measurements and specifications
  
  -- Communication
  notes TEXT,
  internal_notes TEXT, -- Private notes for team
  communication_log JSONB, -- Array of communication events
  
  -- Team assignment
  sales_person TEXT,
  project_manager TEXT,
  installer TEXT,
  
  -- Source tracking
  source TEXT, -- Original lead source
  referral_source TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_deals_lead_id ON deals(lead_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(deal_status);
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON deals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deals_customer_phone ON deals(customer_phone);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment to table
COMMENT ON TABLE deals IS 'Closed leads and deals - advanced CRM table with comprehensive project management fields';


