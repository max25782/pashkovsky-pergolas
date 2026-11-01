-- =============================================================================
-- Migration 055b: close whatsapp_messages
-- NOT APPLIED. Do not run until approved. Independent of 055a/055c/055d.
--
-- Repo search (apps, packages, supabase/functions, scripts, infrastructure,
-- mcp-servers, .github, *.example): no .from('whatsapp_messages') and no
-- anon-key writer. Schema and the three open policies live only in
-- supabase/baseline and 000_baseline.sql. No Edge Function and no webhook
-- in this repository inserts into the table.
-- Anything outside the repo that posts with the anon key would stop. That
-- cannot be seen from these files.
--
-- ---------------------------------------------------------------------------
-- BEFORE
-- ---------------------------------------------------------------------------
-- SELECT policyname, roles::text, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'whatsapp_messages'
-- ORDER BY policyname;
--
-- SELECT grantee, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public' AND table_name = 'whatsapp_messages'
--   AND grantee IN ('PUBLIC','anon','authenticated','service_role')
-- ORDER BY grantee, privilege_type;
--
-- AFTER: no policies. anon/authenticated/PUBLIC have no grants.
--        service_role has ALL.
--
-- SMOKE: there is no in-repo screen. Confirm with the anon key that
--   GET/POST /rest/v1/whatsapp_messages is 401/42501, and that a
--   service_role select still returns rows.
--
-- ---------------------------------------------------------------------------
-- ROLLBACK (emergency only; restores the open policies)
-- ---------------------------------------------------------------------------
-- DROP POLICY IF EXISTS "Admin can view all messages" ON public.whatsapp_messages;
-- CREATE POLICY "Admin can view all messages" ON public.whatsapp_messages AS PERMISSIVE FOR SELECT TO public USING (true);
-- DROP POLICY IF EXISTS "Admin can insert messages" ON public.whatsapp_messages;
-- CREATE POLICY "Admin can insert messages" ON public.whatsapp_messages AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
-- DROP POLICY IF EXISTS "Admin can update messages" ON public.whatsapp_messages;
-- CREATE POLICY "Admin can update messages" ON public.whatsapp_messages AS PERMISSIVE FOR UPDATE TO public USING (true);
-- GRANT ALL ON public.whatsapp_messages TO anon, authenticated;
-- =============================================================================

DROP POLICY IF EXISTS "Admin can view all messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Admin can insert messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Admin can update messages" ON public.whatsapp_messages;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.whatsapp_messages FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.whatsapp_messages TO service_role;
