-- Applied on remote as supabase_migrations.schema_migrations:
-- version 20260116154718, name create_ai_director_sessions_table
-- (Was missing from apps/crm/supabase/migrations; not part of the archived root-only line.)

CREATE TABLE IF NOT EXISTS public.ai_director_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_activity timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.ai_director_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.ai_director_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text])),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_ai_director_sessions_company_id
  ON public.ai_director_sessions (company_id);
CREATE INDEX IF NOT EXISTS idx_ai_director_sessions_last_activity
  ON public.ai_director_sessions (last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_ai_director_messages_session_id
  ON public.ai_director_messages (session_id);
CREATE INDEX IF NOT EXISTS idx_ai_director_messages_created_at
  ON public.ai_director_messages (created_at DESC);

ALTER TABLE public.ai_director_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_director_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ai_director_sessions'
      AND policyname = 'Service role can do everything on ai_director_sessions'
  ) THEN
    CREATE POLICY "Service role can do everything on ai_director_sessions"
      ON public.ai_director_sessions AS PERMISSIVE FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ai_director_sessions'
      AND policyname = 'Users can manage their company ai_director_sessions'
  ) THEN
    CREATE POLICY "Users can manage their company ai_director_sessions"
      ON public.ai_director_sessions AS PERMISSIVE FOR ALL TO public
      USING (
        EXISTS (
          SELECT 1 FROM public.company_members
          WHERE company_members.company_id = ai_director_sessions.company_id
            AND company_members.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.company_members
          WHERE company_members.company_id = ai_director_sessions.company_id
            AND company_members.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ai_director_messages'
      AND policyname = 'Service role can do everything on ai_director_messages'
  ) THEN
    CREATE POLICY "Service role can do everything on ai_director_messages"
      ON public.ai_director_messages AS PERMISSIVE FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ai_director_messages'
      AND policyname = 'Users can manage their company ai_director_messages'
  ) THEN
    CREATE POLICY "Users can manage their company ai_director_messages"
      ON public.ai_director_messages AS PERMISSIVE FOR ALL TO public
      USING (
        EXISTS (
          SELECT 1
          FROM public.ai_director_sessions
          JOIN public.company_members ON company_members.company_id = ai_director_sessions.company_id
          WHERE ai_director_sessions.id = ai_director_messages.session_id
            AND company_members.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.ai_director_sessions
          JOIN public.company_members ON company_members.company_id = ai_director_sessions.company_id
          WHERE ai_director_sessions.id = ai_director_messages.session_id
            AND company_members.user_id = auth.uid()
        )
      );
  END IF;
END $$;
