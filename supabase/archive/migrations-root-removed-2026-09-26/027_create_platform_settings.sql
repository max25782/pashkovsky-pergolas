-- Platform Settings Table (single row)
-- Stores global platform configuration for SuperAdmin

CREATE TABLE IF NOT EXISTS platform_settings (
  id uuid PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001',
  
  -- System Settings
  maintenance_mode boolean DEFAULT false,
  maintenance_message jsonb DEFAULT '{"en":"","he":"","ru":""}'::jsonb,
  
  -- Subscription Settings
  default_plan text DEFAULT 'trial',
  trial_days int DEFAULT 14 CHECK (trial_days >= 0 AND trial_days <= 90),
  
  -- Payment Settings
  manual_payments_enabled boolean DEFAULT true,
  manual_payment_methods jsonb DEFAULT '["bit","paybox","bank"]'::jsonb,
  
  -- AI Settings
  ai_enabled boolean DEFAULT true,
  ai_daily_limit int DEFAULT 100 CHECK (ai_daily_limit > 0),
  
  -- Billing Settings
  vat_percent numeric(5,2) DEFAULT 17.00 CHECK (vat_percent >= 0 AND vat_percent <= 100),
  
  -- Feature Flags (dynamic features)
  feature_flags jsonb DEFAULT '{}'::jsonb,
  
  -- Audit Fields
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Ensure only one row exists
  CONSTRAINT single_row_check CHECK (id = '00000000-0000-0000-0000-000000000001')
);

-- Create function to prevent multiple rows
CREATE OR REPLACE FUNCTION prevent_multiple_platform_settings()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id != '00000000-0000-0000-0000-000000000001' THEN
    RAISE EXCEPTION 'Only one platform settings row is allowed. Use the fixed UUID.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce single row
CREATE TRIGGER enforce_single_platform_settings_row
  BEFORE INSERT OR UPDATE ON platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION prevent_multiple_platform_settings();

-- Insert default settings (if not exists)
INSERT INTO platform_settings (id) 
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS (SuperAdmin access only via SERVICE_ROLE_KEY)
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Policy for SuperAdmin read (in practice, we use SERVICE_ROLE_KEY which bypasses RLS)
CREATE POLICY "SuperAdmin can read platform settings" 
  ON platform_settings 
  FOR SELECT 
  USING (true);

-- Policy for SuperAdmin update
CREATE POLICY "SuperAdmin can update platform settings" 
  ON platform_settings 
  FOR UPDATE 
  USING (true);

-- Add comments for documentation
COMMENT ON TABLE platform_settings IS 'Global platform configuration (single row enforced)';
COMMENT ON COLUMN platform_settings.maintenance_mode IS 'Enable maintenance mode to block all users';
COMMENT ON COLUMN platform_settings.maintenance_message IS 'Message shown during maintenance (i18n)';
COMMENT ON COLUMN platform_settings.default_plan IS 'Default subscription plan for new companies';
COMMENT ON COLUMN platform_settings.trial_days IS 'Number of days for trial period';
COMMENT ON COLUMN platform_settings.manual_payments_enabled IS 'Allow manual payment methods (bit, paybox, bank)';
COMMENT ON COLUMN platform_settings.manual_payment_methods IS 'Available manual payment methods (array)';
COMMENT ON COLUMN platform_settings.ai_enabled IS 'Enable AI features platform-wide';
COMMENT ON COLUMN platform_settings.ai_daily_limit IS 'Daily AI requests limit per company';
COMMENT ON COLUMN platform_settings.vat_percent IS 'Default VAT percentage';
COMMENT ON COLUMN platform_settings.feature_flags IS 'Dynamic feature flags (JSON object)';

