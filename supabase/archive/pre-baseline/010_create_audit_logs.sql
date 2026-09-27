-- ============================================
-- Audit Logs
-- Track user actions for security and compliance
-- ============================================

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Action details
  action TEXT NOT NULL, -- 'login', 'logout', 'create_deal', 'update_deal', 'delete_deal', etc.
  resource_type TEXT, -- 'deal', 'lead', 'user', 'company', etc.
  resource_id UUID, -- ID of the affected resource
  
  -- Request details
  ip_address TEXT,
  user_agent TEXT,
  method TEXT, -- HTTP method
  path TEXT, -- API path
  
  -- Changes (JSONB for flexible storage)
  changes JSONB DEFAULT '{}'::jsonb, -- What changed
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional context
  
  -- Result
  status TEXT DEFAULT 'success', -- 'success', 'error', 'denied'
  error_message TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_action ON audit_logs(company_id, action, created_at DESC);

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Audit logs table created';
END $$;



