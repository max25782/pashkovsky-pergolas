-- ============================================================
-- AluminCRM: ИСПРАВЛЕНИЕ ОШИБОК МИГРАЦИИ
-- ============================================================
-- Этот файл удаляет все существующие объекты и создаёт заново
-- Запустите ТОЛЬКО ЭТОТ файл в Supabase SQL Editor

-- ============================================================
-- УДАЛИТЬ ВСЁ СУЩЕСТВУЮЩЕЕ (если есть)
-- ============================================================

-- Удалить политики
DROP POLICY IF EXISTS "SuperAdmin can read platform settings" ON platform_settings;
DROP POLICY IF EXISTS "SuperAdmin can update platform settings" ON platform_settings;
DROP POLICY IF EXISTS "SuperAdmin can read audit logs" ON platform_audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON platform_audit_logs;

-- Удалить триггеры
DROP TRIGGER IF EXISTS enforce_single_platform_settings_row ON platform_settings;
DROP TRIGGER IF EXISTS log_company_creation_trigger ON companies;

-- Удалить индексы
DROP INDEX IF EXISTS idx_companies_logo_url;
DROP INDEX IF EXISTS idx_platform_audit_logs_created_at;
DROP INDEX IF EXISTS idx_platform_audit_logs_company_id;
DROP INDEX IF EXISTS idx_platform_audit_logs_event_type;

-- Подождать 1 секунду
SELECT pg_sleep(1);

-- ============================================================
-- 1. COMPANY PROFILE
-- ============================================================

ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS country text DEFAULT 'Israel';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS vat_number text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS bank_account text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS bank_branch text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS brand_color text DEFAULT '#2563EB';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS email_signature text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS pdf_footer text;

CREATE INDEX IF NOT EXISTS idx_companies_logo_url ON companies(logo_url) WHERE logo_url IS NOT NULL;

-- ============================================================
-- 2. PLATFORM SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS platform_settings (
  id uuid PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001',
  maintenance_mode boolean DEFAULT false,
  maintenance_message jsonb DEFAULT '{"en":"","he":"","ru":""}'::jsonb,
  default_plan text DEFAULT 'trial',
  trial_days int DEFAULT 14,
  manual_payments_enabled boolean DEFAULT true,
  manual_payment_methods jsonb DEFAULT '["bit","paybox","bank"]'::jsonb,
  ai_enabled boolean DEFAULT true,
  ai_daily_limit int DEFAULT 100,
  vat_percent numeric(5,2) DEFAULT 17.00,
  feature_flags jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE OR REPLACE FUNCTION prevent_multiple_platform_settings()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id != '00000000-0000-0000-0000-000000000001' THEN
    RAISE EXCEPTION 'Only one row allowed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_single_platform_settings_row
  BEFORE INSERT OR UPDATE ON platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION prevent_multiple_platform_settings();

INSERT INTO platform_settings (id) 
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SuperAdmin can read platform settings" 
  ON platform_settings FOR SELECT USING (true);

CREATE POLICY "SuperAdmin can update platform settings" 
  ON platform_settings FOR UPDATE USING (true);

-- ============================================================
-- 3. AUDIT LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS platform_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_admin_id uuid,
  actor_user_id uuid,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_audit_logs_created_at ON platform_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_audit_logs_company_id ON platform_audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_platform_audit_logs_event_type ON platform_audit_logs(event_type);

ALTER TABLE platform_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SuperAdmin can read audit logs" 
  ON platform_audit_logs FOR SELECT USING (true);

CREATE POLICY "System can insert audit logs" 
  ON platform_audit_logs FOR INSERT WITH CHECK (true);

CREATE OR REPLACE FUNCTION log_company_creation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO platform_audit_logs (
    event_type, company_id, actor_user_id, payload
  ) VALUES (
    'company_created', NEW.id, auth.uid(),
    jsonb_build_object('company_name', NEW.name, 'company_slug', NEW.slug)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER log_company_creation_trigger
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION log_company_creation();

-- ============================================================
-- ✅ ГОТОВО!
-- ============================================================
SELECT 'AluminCRM migrations applied successfully!' as status;

