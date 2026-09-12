-- ===================================
-- МИГРАЦИЯ 1: Company Profile Schema
-- ===================================
-- Скопируйте и выполните в Supabase SQL Editor

-- Добавить колонки для профиля компании
ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS country text DEFAULT 'Israel';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS vat_number text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS bank_account text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS bank_branch text;

-- Брендинг (для PDF и Email)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS brand_color text DEFAULT '#2563EB';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS email_signature text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS pdf_footer text;

-- Комментарии
COMMENT ON COLUMN companies.logo_url IS 'Company logo (S3 path or URL)';
COMMENT ON COLUMN companies.brand_color IS 'Primary brand color for PDF/Email (hex format)';
COMMENT ON COLUMN companies.email_signature IS 'Custom signature for outgoing emails';
COMMENT ON COLUMN companies.pdf_footer IS 'Custom footer text for PDF documents';

-- Индекс
CREATE INDEX IF NOT EXISTS idx_companies_logo_url ON companies(logo_url) WHERE logo_url IS NOT NULL;

