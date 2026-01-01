-- ===================================
-- МИГРАЦИЯ 2: Platform Settings
-- ===================================
-- Скопируйте и выполните в Supabase SQL Editor ПОСЛЕ миграции 1

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
  
  -- Feature Flags
  feature_flags jsonb DEFAULT '{}'::jsonb,
  
  -- Audit
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  CONSTRAINT single_row_check CHECK (id = '00000000-0000-0000-0000-000000000001')
);

-- Функция для предотвращения множественных строк
CREATE OR REPLACE FUNCTION prevent_multiple_platform_settings()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id != '00000000-0000-0000-0000-000000000001' THEN
    RAISE EXCEPTION 'Only one platform settings row is allowed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер (удалить если уже существует)
DROP TRIGGER IF EXISTS enforce_single_platform_settings_row ON platform_settings;

CREATE TRIGGER enforce_single_platform_settings_row
  BEFORE INSERT OR UPDATE ON platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION prevent_multiple_platform_settings();

-- Вставить дефолтные настройки
INSERT INTO platform_settings (id) 
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SuperAdmin can read platform settings" 
  ON platform_settings FOR SELECT USING (true);

CREATE POLICY "SuperAdmin can update platform settings" 
  ON platform_settings FOR UPDATE USING (true);

