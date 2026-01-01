-- Migration 014: Add Company Settings
-- Purpose: Each company can customize their defaults, branding, and pricing

-- ============================================
-- 1. CREATE COMPANY_SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Branding
  company_name text,
  logo_url text,
  primary_color text DEFAULT '#3b82f6', -- blue-600
  
  -- Financial
  currency text DEFAULT '₪',
  vat_percent numeric DEFAULT 18,
  
  -- Default Pricing (can be overridden per-offer)
  default_pergola_price_per_sqm numeric DEFAULT 750,
  default_santaf_basic_price numeric DEFAULT 220,
  default_santaf_structure_price numeric DEFAULT 450,
  default_zip_manual_price numeric DEFAULT 650,
  default_zip_electric_price numeric DEFAULT 800,
  default_lighting_price_per_meter numeric DEFAULT 100,
  default_drainage_price_per_meter numeric DEFAULT 80,
  
  -- PDF Templates
  payment_terms_template text DEFAULT 'תשלום: 40% מקדמה, 30% באמצע עבודה, 30% בסיום',
  warranty_years integer DEFAULT 10,
  warranty_covers text[] DEFAULT ARRAY['מבנה אלומיניום', 'צביעה', 'מנגנונים'],
  
  -- Communication Templates
  whatsapp_template text DEFAULT 'שלום {customerName},\n\nלצפייה ואישור הצעת המחיר שלך לחץ כאן:\n{offerUrl}\n\nתודה!\n{companyName}',
  email_subject_template text DEFAULT 'הצעת מחיר - {companyName}',
  email_body_template text DEFAULT '<p>שלום {customerName},</p><p>בצירוף הצעת המחיר שלך.</p>',
  
  -- Features & Limits (will be used by subscription plans)
  features jsonb DEFAULT '{}',
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(company_id)
);

-- ============================================
-- 2. CREATE TRIGGER FOR UPDATED_AT
-- ============================================
CREATE OR REPLACE FUNCTION update_company_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_company_settings_updated_at
  BEFORE UPDATE ON company_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_company_settings_updated_at();

-- ============================================
-- 3. AUTO-CREATE SETTINGS FOR NEW COMPANIES
-- ============================================
CREATE OR REPLACE FUNCTION create_default_company_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO company_settings (company_id, company_name)
  VALUES (NEW.id, NEW.name)
  ON CONFLICT (company_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_company_settings
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION create_default_company_settings();

-- ============================================
-- 4. HELPER FUNCTION: Get Company Settings
-- ============================================
CREATE OR REPLACE FUNCTION get_company_settings(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings jsonb;
BEGIN
  SELECT row_to_json(company_settings.*)::jsonb INTO v_settings
  FROM company_settings
  WHERE company_id = p_company_id;
  
  -- Return settings or defaults if not found
  IF v_settings IS NULL THEN
    v_settings := jsonb_build_object(
      'currency', '₪',
      'vat_percent', 18,
      'default_pergola_price_per_sqm', 750
    );
  END IF;
  
  RETURN v_settings;
END;
$$;

-- ============================================
-- 5. ADD INDEXES
-- ============================================
CREATE INDEX idx_company_settings_company_id 
  ON company_settings(company_id);

-- ============================================
-- 6. BACKFILL SETTINGS FOR EXISTING COMPANIES
-- ============================================
INSERT INTO company_settings (company_id, company_name)
SELECT id, name FROM companies
ON CONFLICT (company_id) DO NOTHING;

-- ============================================
-- 7. ADD COMMENTS
-- ============================================
COMMENT ON TABLE company_settings IS 'Company-specific settings for branding, pricing, and templates';
COMMENT ON COLUMN company_settings.vat_percent IS 'VAT percentage (default 18% for Israel)';
COMMENT ON COLUMN company_settings.features IS 'JSON object with feature flags based on subscription plan';

