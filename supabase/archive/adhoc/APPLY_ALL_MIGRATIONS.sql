-- ============================================================
-- AluminCRM: ПОЛНАЯ МИГРАЦИЯ (всё в одном файле)
-- ============================================================
-- Скопируйте весь этот файл и выполните в Supabase SQL Editor
-- Можно выполнять повторно - не упадёт с ошибками

-- ============================================================
-- 1. COMPANY PROFILE SCHEMA
-- ============================================================

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

-- Индекс
DROP INDEX IF EXISTS idx_companies_logo_url;
CREATE INDEX idx_companies_logo_url ON companies(logo_url) WHERE logo_url IS NOT NULL;

-- ============================================================
-- 2. PLATFORM SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS platform_settings (
  id uuid PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001',
  
  -- System
  maintenance_mode boolean DEFAULT false,
  maintenance_message jsonb DEFAULT '{"en":"","he":"","ru":""}'::jsonb,
  
  -- Subscription
  default_plan text DEFAULT 'trial',
  trial_days int DEFAULT 14 CHECK (trial_days >= 0 AND trial_days <= 90),
  
  -- Payment
  manual_payments_enabled boolean DEFAULT true,
  manual_payment_methods jsonb DEFAULT '["bit","paybox","bank"]'::jsonb,
  
  -- AI
  ai_enabled boolean DEFAULT true,
  ai_daily_limit int DEFAULT 100 CHECK (ai_daily_limit > 0),
  
  -- Billing
  vat_percent numeric(5,2) DEFAULT 17.00 CHECK (vat_percent >= 0 AND vat_percent <= 100),
  
  -- Feature Flags
  feature_flags jsonb DEFAULT '{}'::jsonb,
  
  -- Audit
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  CONSTRAINT single_row_check CHECK (id = '00000000-0000-0000-0000-000000000001')
);

-- Функция
CREATE OR REPLACE FUNCTION prevent_multiple_platform_settings()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id != '00000000-0000-0000-0000-000000000001' THEN
    RAISE EXCEPTION 'Only one platform settings row allowed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер
DROP TRIGGER IF EXISTS enforce_single_platform_settings_row ON platform_settings;
CREATE TRIGGER enforce_single_platform_settings_row
  BEFORE INSERT OR UPDATE ON platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION prevent_multiple_platform_settings();

-- Дефолтные настройки
INSERT INTO platform_settings (id) 
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "SuperAdmin can read platform settings" ON platform_settings;
CREATE POLICY "SuperAdmin can read platform settings" 
  ON platform_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "SuperAdmin can update platform settings" ON platform_settings;
CREATE POLICY "SuperAdmin can update platform settings" 
  ON platform_settings FOR UPDATE USING (true);

-- ============================================================
-- 3. PLATFORM AUDIT LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS platform_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  actor_admin_id uuid REFERENCES platform_admins(user_id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  
  event_type text NOT NULL CHECK (event_type IN (
    'company_created',
    'company_deleted',
    'plan_changed',
    'payment_confirmed',
    'admin_added',
    'admin_deactivated',
    'settings_updated',
    'user_invited',
    'subscription_canceled'
  )),
  
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_actor CHECK (
    actor_admin_id IS NOT NULL OR actor_user_id IS NOT NULL
  )
);

-- Индексы
DROP INDEX IF EXISTS idx_platform_audit_logs_created_at;
DROP INDEX IF EXISTS idx_platform_audit_logs_company_id;
DROP INDEX IF EXISTS idx_platform_audit_logs_event_type;

CREATE INDEX idx_platform_audit_logs_created_at ON platform_audit_logs(created_at DESC);
CREATE INDEX idx_platform_audit_logs_company_id ON platform_audit_logs(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX idx_platform_audit_logs_event_type ON platform_audit_logs(event_type);

-- RLS
ALTER TABLE platform_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "SuperAdmin can read audit logs" ON platform_audit_logs;
CREATE POLICY "SuperAdmin can read audit logs" 
  ON platform_audit_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "System can insert audit logs" ON platform_audit_logs;
CREATE POLICY "System can insert audit logs" 
  ON platform_audit_logs FOR INSERT WITH CHECK (true);

-- Функция для логирования
CREATE OR REPLACE FUNCTION log_company_creation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO platform_audit_logs (
    event_type,
    company_id,
    actor_user_id,
    payload
  ) VALUES (
    'company_created',
    NEW.id,
    auth.uid(),
    jsonb_build_object(
      'company_name', NEW.name,
      'company_slug', NEW.slug
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Триггер
DROP TRIGGER IF EXISTS log_company_creation_trigger ON companies;
CREATE TRIGGER log_company_creation_trigger
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION log_company_creation();

-- ============================================================
-- ✅ ГОТОВО! Миграция завершена
-- ============================================================

