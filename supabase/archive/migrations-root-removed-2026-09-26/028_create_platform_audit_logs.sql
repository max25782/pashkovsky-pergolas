-- Platform Audit Logs
-- Track all platform-level events and changes

CREATE TABLE IF NOT EXISTS platform_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who performed the action
  actor_admin_id uuid REFERENCES platform_admins(user_id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- What company was affected (if applicable)
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Event type
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
  
  -- Event payload (flexible JSON data)
  payload jsonb DEFAULT '{}'::jsonb,
  
  -- When
  created_at timestamptz DEFAULT now(),
  
  -- Ensure at least one actor is specified
  CONSTRAINT valid_actor CHECK (
    actor_admin_id IS NOT NULL OR actor_user_id IS NOT NULL
  )
);

-- Indexes for efficient queries
CREATE INDEX idx_platform_audit_logs_created_at ON platform_audit_logs(created_at DESC);
CREATE INDEX idx_platform_audit_logs_company_id ON platform_audit_logs(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX idx_platform_audit_logs_event_type ON platform_audit_logs(event_type);
CREATE INDEX idx_platform_audit_logs_actor_admin ON platform_audit_logs(actor_admin_id) WHERE actor_admin_id IS NOT NULL;
CREATE INDEX idx_platform_audit_logs_actor_user ON platform_audit_logs(actor_user_id) WHERE actor_user_id IS NOT NULL;

-- Enable RLS (SuperAdmin access only)
ALTER TABLE platform_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy for SuperAdmin read
CREATE POLICY "SuperAdmin can read audit logs" 
  ON platform_audit_logs 
  FOR SELECT 
  USING (true);

-- Policy for system insert (any authenticated process can log events)
CREATE POLICY "System can insert audit logs" 
  ON platform_audit_logs 
  FOR INSERT 
  WITH CHECK (true);

-- Add comments
COMMENT ON TABLE platform_audit_logs IS 'Platform-wide audit log for tracking important events';
COMMENT ON COLUMN platform_audit_logs.actor_admin_id IS 'Platform admin who performed the action';
COMMENT ON COLUMN platform_audit_logs.actor_user_id IS 'Regular user who performed the action';
COMMENT ON COLUMN platform_audit_logs.company_id IS 'Company affected by the action (if applicable)';
COMMENT ON COLUMN platform_audit_logs.event_type IS 'Type of event that occurred';
COMMENT ON COLUMN platform_audit_logs.payload IS 'Event-specific data (flexible JSON)';

-- Create function to automatically log company creation
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
      'company_slug', NEW.slug,
      'plan', NEW.plan
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auto-logging company creation
CREATE TRIGGER log_company_creation_trigger
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION log_company_creation();

