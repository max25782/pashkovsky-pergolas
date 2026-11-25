-- 072_ai_chat_company_isolation.sql
--
-- Tenant-isolate public AI chat sessions and close open policies on
-- whatsapp_messages, ai_reminders, ai_reports, ai_insights.
--
-- Backfill uses the Pashkovsky companies.id already stored in 057/058/064
-- and lib/tazrim/access.ts.
--
-- Service-role API routes still bypass RLS — they MUST filter by company_id
-- in application code (see admin-api/ai-chats and ai-chat routes).

-- ---------------------------------------------------------------------------
-- ai_sessions: add company_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.ai_sessions
  ADD COLUMN IF NOT EXISTS company_id uuid;

UPDATE public.ai_sessions
SET company_id = '6998295e-89ae-4e3d-afd2-8c2b0333eac2'::uuid
WHERE company_id IS NULL;

ALTER TABLE public.ai_sessions
  ALTER COLUMN company_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_sessions_company_id_fkey'
  ) THEN
    ALTER TABLE public.ai_sessions
      ADD CONSTRAINT ai_sessions_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.companies (id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ai_sessions_company_id
  ON public.ai_sessions (company_id);

CREATE INDEX IF NOT EXISTS idx_ai_sessions_company_client
  ON public.ai_sessions (company_id, client_id);

CREATE INDEX IF NOT EXISTS idx_ai_sessions_company_activity
  ON public.ai_sessions (company_id, last_activity DESC);

-- Drop open PUBLIC policies; membership SELECT for authenticated.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ai_sessions'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.ai_sessions', r.policyname);
  END LOOP;
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ai_messages'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.ai_messages', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.ai_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ai_sessions FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.ai_messages FROM PUBLIC, anon;

GRANT SELECT ON TABLE public.ai_sessions TO authenticated;
GRANT SELECT ON TABLE public.ai_messages TO authenticated;
GRANT ALL ON TABLE public.ai_sessions TO service_role;
GRANT ALL ON TABLE public.ai_messages TO service_role;

CREATE POLICY ai_sessions_select_member
  ON public.ai_sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members m
      WHERE m.user_id = auth.uid()
        AND m.company_id = ai_sessions.company_id
    )
  );

CREATE POLICY ai_messages_select_member
  ON public.ai_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ai_sessions s
      JOIN public.company_members m ON m.company_id = s.company_id
      WHERE s.id = ai_messages.session_id
        AND m.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- whatsapp_messages: company_id + drop USING (true)
-- ---------------------------------------------------------------------------
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS company_id uuid;

UPDATE public.whatsapp_messages w
SET company_id = d.company_id
FROM public.deals d
WHERE w.deal_id = d.id
  AND w.company_id IS NULL;

UPDATE public.whatsapp_messages w
SET company_id = l.company_id
FROM public.leads l
WHERE w.lead_id = l.id
  AND w.company_id IS NULL;

UPDATE public.whatsapp_messages
SET company_id = '6998295e-89ae-4e3d-afd2-8c2b0333eac2'::uuid
WHERE company_id IS NULL;

ALTER TABLE public.whatsapp_messages
  ALTER COLUMN company_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_messages_company_id_fkey'
  ) THEN
    ALTER TABLE public.whatsapp_messages
      ADD CONSTRAINT whatsapp_messages_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.companies (id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_company_id
  ON public.whatsapp_messages (company_id);

DROP POLICY IF EXISTS "Admin can view all messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Admin can insert messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Admin can update messages" ON public.whatsapp_messages;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'whatsapp_messages'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.whatsapp_messages', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.whatsapp_messages FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.whatsapp_messages TO authenticated;
GRANT ALL ON TABLE public.whatsapp_messages TO service_role;

CREATE POLICY whatsapp_messages_select_member
  ON public.whatsapp_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members m
      WHERE m.user_id = auth.uid()
        AND m.company_id = whatsapp_messages.company_id
    )
  );

CREATE POLICY whatsapp_messages_insert_member
  ON public.whatsapp_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members m
      WHERE m.user_id = auth.uid()
        AND m.company_id = whatsapp_messages.company_id
    )
  );

CREATE POLICY whatsapp_messages_update_member
  ON public.whatsapp_messages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members m
      WHERE m.user_id = auth.uid()
        AND m.company_id = whatsapp_messages.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members m
      WHERE m.user_id = auth.uid()
        AND m.company_id = whatsapp_messages.company_id
    )
  );

CREATE POLICY whatsapp_messages_delete_member
  ON public.whatsapp_messages
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members m
      WHERE m.user_id = auth.uid()
        AND m.company_id = whatsapp_messages.company_id
    )
  );

-- ---------------------------------------------------------------------------
-- ai_insights / ai_reminders / ai_reports: company_id + membership RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.ai_insights
  ADD COLUMN IF NOT EXISTS company_id uuid;

ALTER TABLE public.ai_reminders
  ADD COLUMN IF NOT EXISTS company_id uuid;

ALTER TABLE public.ai_reports
  ADD COLUMN IF NOT EXISTS company_id uuid;

UPDATE public.ai_insights i
SET company_id = d.company_id
FROM public.deals d
WHERE i.deal_id = d.id
  AND i.company_id IS NULL;

UPDATE public.ai_reminders r
SET company_id = d.company_id
FROM public.deals d
WHERE r.deal_id = d.id
  AND r.company_id IS NULL;

UPDATE public.ai_reminders r
SET company_id = l.company_id
FROM public.leads l
WHERE r.lead_id = l.id
  AND r.company_id IS NULL;

UPDATE public.ai_insights
SET company_id = '6998295e-89ae-4e3d-afd2-8c2b0333eac2'::uuid
WHERE company_id IS NULL;

UPDATE public.ai_reminders
SET company_id = '6998295e-89ae-4e3d-afd2-8c2b0333eac2'::uuid
WHERE company_id IS NULL;

UPDATE public.ai_reports
SET company_id = '6998295e-89ae-4e3d-afd2-8c2b0333eac2'::uuid
WHERE company_id IS NULL;

ALTER TABLE public.ai_insights ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.ai_reminders ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.ai_reports ALTER COLUMN company_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_insights_company_id_fkey') THEN
    ALTER TABLE public.ai_insights
      ADD CONSTRAINT ai_insights_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.companies (id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_reminders_company_id_fkey') THEN
    ALTER TABLE public.ai_reminders
      ADD CONSTRAINT ai_reminders_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.companies (id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_reports_company_id_fkey') THEN
    ALTER TABLE public.ai_reports
      ADD CONSTRAINT ai_reports_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.companies (id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ai_insights_company_id ON public.ai_insights (company_id);
CREATE INDEX IF NOT EXISTS idx_ai_reminders_company_id ON public.ai_reminders (company_id);
CREATE INDEX IF NOT EXISTS idx_ai_reports_company_id ON public.ai_reports (company_id);

DO $$
DECLARE
  t text;
  r record;
BEGIN
  FOREACH t IN ARRAY ARRAY['ai_insights', 'ai_reminders', 'ai_reports']
  LOOP
    FOR r IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon', t);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (
         EXISTS (
           SELECT 1 FROM public.company_members m
           WHERE m.user_id = auth.uid() AND m.company_id = %I.company_id
         )
       )',
      t || '_select_member', t, t
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (
         EXISTS (
           SELECT 1 FROM public.company_members m
           WHERE m.user_id = auth.uid() AND m.company_id = %I.company_id
         )
       )',
      t || '_insert_member', t, t
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (
         EXISTS (
           SELECT 1 FROM public.company_members m
           WHERE m.user_id = auth.uid() AND m.company_id = %I.company_id
         )
       ) WITH CHECK (
         EXISTS (
           SELECT 1 FROM public.company_members m
           WHERE m.user_id = auth.uid() AND m.company_id = %I.company_id
         )
       )',
      t || '_update_member', t, t, t
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (
         EXISTS (
           SELECT 1 FROM public.company_members m
           WHERE m.user_id = auth.uid() AND m.company_id = %I.company_id
         )
       )',
      t || '_delete_member', t, t
    );
  END LOOP;
END $$;
