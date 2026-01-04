-- ==========================================
-- Company Website Integrations
-- ==========================================
-- One-time paid service for website lead integration

-- 1. Create company_integrations table
CREATE TABLE IF NOT EXISTS public.company_integrations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid UNIQUE NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'webhook' CHECK (type IN ('webhook', 'wordpress')),
  status text NOT NULL DEFAULT 'not_connected' 
    CHECK (status IN ('not_connected', 'pending_payment', 'active', 'suspended')),
  website_url text,
  webhook_secret text NOT NULL,
  last_event_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.company_integrations IS 'Company website integrations - one-time paid service';
COMMENT ON COLUMN public.company_integrations.webhook_secret IS 'Random secret for HMAC-SHA256 signature verification';
COMMENT ON COLUMN public.company_integrations.status IS 'not_connected | pending_payment | active | suspended';

-- 2. Create integration_events table
CREATE TABLE IF NOT EXISTS public.integration_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES public.company_integrations(id) ON DELETE SET NULL,
  event_type text NOT NULL 
    CHECK (event_type IN ('lead_received', 'test_ping', 'setup_requested', 'activated', 'suspended')),
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.integration_events IS 'Integration event log for debugging and audit';

-- 3. Create indexes
CREATE INDEX idx_company_integrations_company_id ON public.company_integrations(company_id);
CREATE INDEX idx_company_integrations_status ON public.company_integrations(status);
CREATE UNIQUE INDEX idx_company_integrations_webhook_secret ON public.company_integrations(webhook_secret);

CREATE INDEX idx_integration_events_company_id ON public.integration_events(company_id);
CREATE INDEX idx_integration_events_integration_id ON public.integration_events(integration_id);
CREATE INDEX idx_integration_events_created_at ON public.integration_events(created_at DESC);
CREATE INDEX idx_integration_events_event_type ON public.integration_events(event_type);

-- 4. Create trigger for updated_at
CREATE TRIGGER company_integrations_updated_at
  BEFORE UPDATE ON public.company_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 5. Enable RLS
ALTER TABLE public.company_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS Policies for company_integrations

-- Company members can read their own integration
CREATE POLICY "Company members can view their integration"
  ON public.company_integrations
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM public.company_members 
      WHERE user_id = auth.uid()
    )
  );

-- Service role can do everything (for API)
CREATE POLICY "Service role can manage integrations"
  ON public.company_integrations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 7. Create RLS Policies for integration_events

-- Company members can read their own events
CREATE POLICY "Company members can view their integration events"
  ON public.integration_events
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM public.company_members 
      WHERE user_id = auth.uid()
    )
  );

-- Service role can insert events
CREATE POLICY "Service role can insert integration events"
  ON public.integration_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Service role can read all events
CREATE POLICY "Service role can read all integration events"
  ON public.integration_events
  FOR SELECT
  TO service_role
  USING (true);

-- 8. Update platform_audit_logs event_type constraint to include integration events
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'platform_audit_logs_event_type_check'
  ) THEN
    ALTER TABLE public.platform_audit_logs 
    DROP CONSTRAINT platform_audit_logs_event_type_check;
    
    ALTER TABLE public.platform_audit_logs
    ADD CONSTRAINT platform_audit_logs_event_type_check
    CHECK (event_type IN (
      'company_created',
      'company_deleted',
      'plan_changed',
      'payment_confirmed',
      'admin_added',
      'admin_deactivated',
      'settings_updated',
      'user_invited',
      'subscription_canceled',
      'integration_activated',
      'integration_suspended',
      'integration_secret_rotated'
    ));
  END IF;
END $$;

-- 9. Grant permissions
GRANT SELECT ON public.company_integrations TO authenticated;
GRANT SELECT ON public.integration_events TO authenticated;
GRANT ALL ON public.company_integrations TO service_role;
GRANT ALL ON public.integration_events TO service_role;

