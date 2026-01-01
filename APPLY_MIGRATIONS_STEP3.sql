-- ===================================
-- МИГРАЦИЯ 3: Platform Audit Logs
-- ===================================
-- Скопируйте и выполните в Supabase SQL Editor ПОСЛЕ миграции 2

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

-- Индексы (удалить если уже существуют)
DROP INDEX IF EXISTS idx_platform_audit_logs_created_at;
DROP INDEX IF EXISTS idx_platform_audit_logs_company_id;
DROP INDEX IF EXISTS idx_platform_audit_logs_event_type;

CREATE INDEX idx_platform_audit_logs_created_at ON platform_audit_logs(created_at DESC);
CREATE INDEX idx_platform_audit_logs_company_id ON platform_audit_logs(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX idx_platform_audit_logs_event_type ON platform_audit_logs(event_type);

-- RLS
ALTER TABLE platform_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SuperAdmin can read audit logs" 
  ON platform_audit_logs FOR SELECT USING (true);

CREATE POLICY "System can insert audit logs" 
  ON platform_audit_logs FOR INSERT WITH CHECK (true);

-- Триггер для автоматического логирования создания компаний
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

-- Триггер (удалить если уже существует)
DROP TRIGGER IF EXISTS log_company_creation_trigger ON companies;

CREATE TRIGGER log_company_creation_trigger
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION log_company_creation();

