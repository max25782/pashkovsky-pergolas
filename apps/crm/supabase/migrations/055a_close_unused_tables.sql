-- =============================================================================
-- Migration 055a: close tables with no anon/authenticated consumer
-- NOT APPLIED. Do not run until approved. Nothing here has been executed.
-- Independent of 055b, 055c, 055d. Safe after 054. Idempotent.
--
-- Tables: platform_settings, platform_audit_logs, ai_insights, ai_reminders,
--         ai_reports, deal_tags, ai_rate_limits.
--
-- Why no authenticated policies (minimal choice):
--   The previous draft created TO authenticated policies and then
--   REVOKE ALL FROM authenticated. A policy never runs without a table
--   privilege, so those policies were dead.
--   platform_settings / platform_audit_logs would also recurse: their
--   USING clause reads public.platform_admins, whose own policy
--   "Platform admins can view platform admins" (baseline
--   schema_baseline_2026-08-08.sql, TO authenticated) reads platform_admins
--   again. Postgres raises "infinite recursion detected in policy".
--   GRANT plus that policy would not work. Every writer found in the repo
--   uses SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
--
-- ai_rate_limits writer (grep): apps/crm/app/api/ai-chat/route.ts
--   createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
--   key column: client_id (unique)
--   select * eq client_id; insert { client_id, message_count, window_start };
--   update { message_count, window_start } eq client_id.
--   No other .from('ai_rate_limits') in apps, packages, scripts,
--   infrastructure, mcp-servers, .github.
--
-- ai_messages / ai_sessions are not in this file.
--   Live snapshot already has service_role policies and company_select
--   (ai_sessions_service_all / ai_messages_service_all FOR ALL TO service_role,
--    ai_sessions_company_select / ai_messages_company_select FOR SELECT
--    TO authenticated). The August 2026 baseline file still shows the older
--    "Service role can do everything … TO public USING (true)". This
--    migration does not change those two tables.
--
-- ---------------------------------------------------------------------------
-- BEFORE (read-only; same shape as the 054 privilege check)
-- ---------------------------------------------------------------------------
-- SELECT tablename, policyname, roles::text, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'platform_settings','platform_audit_logs','ai_insights','ai_reminders',
--     'ai_reports','deal_tags','ai_rate_limits'
--   )
-- ORDER BY tablename, policyname;
--
-- SELECT table_name, grantee, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public'
--   AND table_name IN (
--     'platform_settings','platform_audit_logs','ai_insights','ai_reminders',
--     'ai_reports','deal_tags','ai_rate_limits'
--   )
--   AND grantee IN ('PUBLIC','anon','authenticated','service_role')
-- ORDER BY table_name, grantee, privilege_type;
--
-- AFTER: zero rows in pg_policies for those tables.
--        anon/authenticated/PUBLIC absent from role_table_grants.
--        service_role has SELECT, INSERT, UPDATE, DELETE (GRANT ALL).
--
-- SMOKE (hands, after apply, not from this file):
--   1. Superadmin settings page and PUT /api/platform/settings still load
--      (service_role). A row appears in platform_audit_logs.
--   2. Public site chat POST /api/ai-chat still answers; a second message
--      in the same hour increments ai_rate_limits.message_count for that
--      client_id cookie.
--   3. With the anon key, GET /rest/v1/platform_settings and
--      /rest/v1/ai_rate_limits return 401/42501, not the rows.
--
-- ---------------------------------------------------------------------------
-- ROLLBACK (emergency only; restores the open policies)
-- ---------------------------------------------------------------------------
-- DROP POLICY IF EXISTS "SuperAdmin can read platform settings" ON public.platform_settings;
-- CREATE POLICY "SuperAdmin can read platform settings" ON public.platform_settings AS PERMISSIVE FOR SELECT TO public USING (true);
-- DROP POLICY IF EXISTS "SuperAdmin can update platform settings" ON public.platform_settings;
-- CREATE POLICY "SuperAdmin can update platform settings" ON public.platform_settings AS PERMISSIVE FOR UPDATE TO public USING (true);
-- GRANT ALL ON public.platform_settings TO anon, authenticated;
--
-- DROP POLICY IF EXISTS "SuperAdmin can read audit logs" ON public.platform_audit_logs;
-- CREATE POLICY "SuperAdmin can read audit logs" ON public.platform_audit_logs AS PERMISSIVE FOR SELECT TO public USING (true);
-- DROP POLICY IF EXISTS "System can insert audit logs" ON public.platform_audit_logs;
-- CREATE POLICY "System can insert audit logs" ON public.platform_audit_logs AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
-- GRANT ALL ON public.platform_audit_logs TO anon, authenticated;
--
-- DROP POLICY IF EXISTS "Service role can do everything on ai_rate_limits" ON public.ai_rate_limits;
-- CREATE POLICY "Service role can do everything on ai_rate_limits" ON public.ai_rate_limits AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
-- GRANT ALL ON public.ai_rate_limits TO anon, authenticated;
--
-- DROP POLICY IF EXISTS "Admin can manage reminders" ON public.ai_reminders;
-- CREATE POLICY "Admin can manage reminders" ON public.ai_reminders AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
-- GRANT ALL ON public.ai_reminders TO anon, authenticated;
-- DROP POLICY IF EXISTS "Admin can manage insights" ON public.ai_insights;
-- CREATE POLICY "Admin can manage insights" ON public.ai_insights AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
-- GRANT ALL ON public.ai_insights TO anon, authenticated;
-- DROP POLICY IF EXISTS "Admin can manage reports" ON public.ai_reports;
-- CREATE POLICY "Admin can manage reports" ON public.ai_reports AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
-- GRANT ALL ON public.ai_reports TO anon, authenticated;
-- DROP POLICY IF EXISTS "Admin can manage tags" ON public.deal_tags;
-- CREATE POLICY "Admin can manage tags" ON public.deal_tags AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
-- GRANT ALL ON public.deal_tags TO anon, authenticated;
-- =============================================================================

-- platform_settings
DROP POLICY IF EXISTS "SuperAdmin can read platform settings" ON public.platform_settings;
DROP POLICY IF EXISTS "SuperAdmin can update platform settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Platform admins read settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Platform admins update settings" ON public.platform_settings;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.platform_settings TO service_role;

-- platform_audit_logs
DROP POLICY IF EXISTS "SuperAdmin can read audit logs" ON public.platform_audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.platform_audit_logs;
DROP POLICY IF EXISTS "Platform admins read audit logs" ON public.platform_audit_logs;
ALTER TABLE public.platform_audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_audit_logs FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.platform_audit_logs TO service_role;

-- ai_insights, ai_reminders, ai_reports, deal_tags
DROP POLICY IF EXISTS "Admin can manage insights" ON public.ai_insights;
DROP POLICY IF EXISTS "Company members manage ai_insights" ON public.ai_insights;
DROP POLICY IF EXISTS "Admin can manage reminders" ON public.ai_reminders;
DROP POLICY IF EXISTS "Company members manage ai_reminders" ON public.ai_reminders;
DROP POLICY IF EXISTS "Admin can manage reports" ON public.ai_reports;
DROP POLICY IF EXISTS "Admin can manage tags" ON public.deal_tags;
DROP POLICY IF EXISTS "Company members manage deal_tags" ON public.deal_tags;
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_tags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_insights, public.ai_reminders, public.ai_reports, public.deal_tags FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.ai_insights, public.ai_reminders, public.ai_reports, public.deal_tags TO service_role;

-- ai_rate_limits (policy name says service role; roles in the baseline are PUBLIC)
DROP POLICY IF EXISTS "Service role can do everything on ai_rate_limits" ON public.ai_rate_limits;
ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.ai_rate_limits TO service_role;
