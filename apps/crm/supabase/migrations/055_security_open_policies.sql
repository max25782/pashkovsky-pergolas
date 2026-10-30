-- =============================================================================
-- Migration 055: Close permissive RLS (USING true) + tighten grants / RPC EXECUTE
-- NOT APPLIED until explicitly approved (prod: kvqupacmdishpfnscnio).
-- Apply after 054 (or independently if 054 already applied).
--
-- Browser usage audit (apps/, 2026-10-27) — see report in PR / chat:
--   whatsapp_messages, ai_insights/reminders/reports, deal_tags → no .from() in apps
--   platform_* → service_role API/RSC only
--   offers → browser: TodayQueue (authenticated JWT); public pages → service_role
--   pergola_projects → site SSR/API uses anon server-side (public gallery)
--   Realtime: ai_messages / ai_sessions only (not in scope of this migration)
--
-- OUT OF SCOPE (separate migration):
--   - handle_new_user hardcoded admin email (max25782@gmail.com)
--   - function_search_path_mutable (34 functions)
--   - ai_messages / ai_sessions policies (still "Service role … TO PUBLIC true")
--
-- BEFORE APPLY
-- ---------------------------------------------------------------------------
-- 1. Staging/local: two company users must not see each other's offers/deals (see report).
-- 2. Site gallery: /[locale]/pergulas loads via anon key — needs anon SELECT on pergola_projects.
--    Prod columns (2026-10-27): id, title_{he,ru,en}, desc_{he,ru,en}, images, created_at.
--    No company_id, user_id, customer PII — marketing-only; view not required.
--    Site uses explicit .select(...) list (not select=*).
-- 3. Superadmin + platform APIs use service_role — unaffected by authenticated REVOKE.
--
-- AFTER APPLY
-- ---------------------------------------------------------------------------
-- Security Advisor: fewer permissive policies; re-run get_advisors(security).
-- Smoke: public offer approve page, quick-offer, superadmin settings, site pergulas gallery.
--
-- ---------------------------------------------------------------------------
-- ROLLBACK (manual; snippets restore baseline intent — review before running)
-- ---------------------------------------------------------------------------
-- -- offers anon (INSECURE — baseline had both):
-- CREATE POLICY "Anon read offer by id" ON public.offers FOR SELECT TO anon USING (true);
-- CREATE POLICY "Public can read offer by id" ON public.offers FOR SELECT TO anon USING (true);
-- GRANT SELECT ON public.offers TO anon;
--
-- -- platform_settings / platform_audit_logs (INSECURE baseline):
-- CREATE POLICY "SuperAdmin can read platform settings" ON public.platform_settings FOR SELECT TO public USING (true);
-- CREATE POLICY "SuperAdmin can update platform settings" ON public.platform_settings FOR UPDATE TO public USING (true);
-- CREATE POLICY "SuperAdmin can read audit logs" ON public.platform_audit_logs FOR SELECT TO public USING (true);
-- CREATE POLICY "System can insert audit logs" ON public.platform_audit_logs FOR INSERT TO public WITH CHECK (true);
-- GRANT ALL ON public.platform_settings, public.platform_audit_logs TO anon, authenticated;
--
-- -- whatsapp_messages (INSECURE baseline):
-- CREATE POLICY "Admin can view all messages" ON public.whatsapp_messages FOR SELECT TO public USING (true);
-- CREATE POLICY "Admin can insert messages" ON public.whatsapp_messages FOR INSERT TO public WITH CHECK (true);
-- CREATE POLICY "Admin can update messages" ON public.whatsapp_messages FOR UPDATE TO public USING (true);
-- GRANT ALL ON public.whatsapp_messages TO anon, authenticated;
--
-- -- ai_* / deal_tags (INSECURE baseline):
-- CREATE POLICY "Admin can manage insights" ON public.ai_insights FOR ALL TO public USING (true) WITH CHECK (true);
-- CREATE POLICY "Admin can manage reminders" ON public.ai_reminders FOR ALL TO public USING (true) WITH CHECK (true);
-- CREATE POLICY "Admin can manage reports" ON public.ai_reports FOR ALL TO public USING (true) WITH CHECK (true);
-- CREATE POLICY "Admin can manage tags" ON public.deal_tags FOR ALL TO public USING (true) WITH CHECK (true);
-- GRANT ALL ON public.ai_insights, public.ai_reminders, public.ai_reports, public.deal_tags TO anon, authenticated;
--
-- -- pergola_projects:
-- DROP POLICY IF EXISTS "Anon can read marketing gallery" ON public.pergola_projects;
-- CREATE POLICY "Public can read pergola_projects" ON public.pergola_projects FOR SELECT TO public USING (true);
--
-- -- RPC EXECUTE (restore PUBLIC — INSECURE):
-- GRANT EXECUTE ON FUNCTION pergola_configurator.set_user_role(uuid, pergola_configurator.user_role) TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION pergola_configurator.set_user_role_by_email(text, pergola_configurator.user_role) TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION pergola_configurator.is_admin(uuid) TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION pergola_configurator.handle_new_user() TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO PUBLIC, anon, authenticated;
-- =============================================================================

-- ── Helper: active platform superadmin ──
-- (Used for optional authenticated read paths; server today uses service_role.)

-- =============================================================================
-- 1. platform_settings
-- =============================================================================

DROP POLICY IF EXISTS "SuperAdmin can read platform settings" ON public.platform_settings;
DROP POLICY IF EXISTS "SuperAdmin can update platform settings" ON public.platform_settings;

REVOKE ALL ON TABLE public.platform_settings FROM anon, authenticated;

CREATE POLICY "Platform admins read settings"
  ON public.platform_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid() AND pa.is_active = true
    )
  );

CREATE POLICY "Platform admins update settings"
  ON public.platform_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid() AND pa.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid() AND pa.is_active = true
    )
  );

-- service_role bypasses RLS; explicit grant for clarity
GRANT SELECT, UPDATE ON TABLE public.platform_settings TO service_role;

-- =============================================================================
-- 2. platform_audit_logs
-- =============================================================================

DROP POLICY IF EXISTS "SuperAdmin can read audit logs" ON public.platform_audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.platform_audit_logs;

REVOKE ALL ON TABLE public.platform_audit_logs FROM anon, authenticated;

CREATE POLICY "Platform admins read audit logs"
  ON public.platform_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid() AND pa.is_active = true
    )
  );

GRANT SELECT, INSERT ON TABLE public.platform_audit_logs TO service_role;

-- =============================================================================
-- 3. whatsapp_messages (no browser .from() in apps — server/webhook path later)
-- =============================================================================

DROP POLICY IF EXISTS "Admin can view all messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Admin can insert messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Admin can update messages" ON public.whatsapp_messages;

REVOKE ALL ON TABLE public.whatsapp_messages FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.whatsapp_messages TO service_role;

-- Future CRM UI: add authenticated policies scoped via deal_id / lead_id → company_members.

-- =============================================================================
-- 4. offers — remove anon table leak; keep company-scoped authenticated policies
-- =============================================================================

DROP POLICY IF EXISTS "Anon read offer by id" ON public.offers;
DROP POLICY IF EXISTS "Public can read offer by id" ON public.offers;

REVOKE SELECT ON TABLE public.offers FROM anon;

-- authenticated company policies unchanged (baseline):
--   Company members view own offers, Users can view own company offers, etc.

-- =============================================================================
-- 5. ai_insights, ai_reminders, deal_tags — company via deal/lead
-- =============================================================================

DROP POLICY IF EXISTS "Admin can manage insights" ON public.ai_insights;
DROP POLICY IF EXISTS "Admin can manage reminders" ON public.ai_reminders;
DROP POLICY IF EXISTS "Admin can manage tags" ON public.deal_tags;

REVOKE ALL ON TABLE public.ai_insights, public.ai_reminders, public.deal_tags FROM anon, authenticated;

CREATE POLICY "Company members manage ai_insights"
  ON public.ai_insights
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.deals d
      JOIN public.company_members cm ON cm.company_id = d.company_id
      WHERE d.id = ai_insights.deal_id AND cm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.deals d
      JOIN public.company_members cm ON cm.company_id = d.company_id
      WHERE d.id = ai_insights.deal_id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Company members manage ai_reminders"
  ON public.ai_reminders
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.deals d
      JOIN public.company_members cm ON cm.company_id = d.company_id
      WHERE d.id = ai_reminders.deal_id AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.leads l
      JOIN public.company_members cm ON cm.company_id = l.company_id
      WHERE l.id = ai_reminders.lead_id AND cm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.deals d
      JOIN public.company_members cm ON cm.company_id = d.company_id
      WHERE d.id = ai_reminders.deal_id AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.leads l
      JOIN public.company_members cm ON cm.company_id = l.company_id
      WHERE l.id = ai_reminders.lead_id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Company members manage deal_tags"
  ON public.deal_tags
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.deals d
      JOIN public.company_members cm ON cm.company_id = d.company_id
      WHERE d.id = deal_tags.deal_id AND cm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.deals d
      JOIN public.company_members cm ON cm.company_id = d.company_id
      WHERE d.id = deal_tags.deal_id AND cm.user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_insights, public.ai_reminders, public.deal_tags TO service_role;

-- =============================================================================
-- 6. ai_reports — no company_id / deal_id; server-only
-- =============================================================================

DROP POLICY IF EXISTS "Admin can manage reports" ON public.ai_reports;

REVOKE ALL ON TABLE public.ai_reports FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_reports TO service_role;

-- =============================================================================
-- 7. pergola_projects — marketing gallery (site SSR uses anon); not tenant-scoped
-- =============================================================================

DROP POLICY IF EXISTS "Public can read pergola_projects" ON public.pergola_projects;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.pergola_projects FROM anon, authenticated;

CREATE POLICY "Anon can read marketing gallery"
  ON public.pergola_projects
  FOR SELECT
  TO anon
  USING (true);

GRANT SELECT ON TABLE public.pergola_projects TO anon;

-- CRM admin-api / api/pergola-projects use service_role (existing service_role policy).

-- =============================================================================
-- 8. RPC EXECUTE — remove PUBLIC/anon/authenticated on role escalation helpers
-- =============================================================================

REVOKE ALL ON FUNCTION pergola_configurator.set_user_role(uuid, pergola_configurator.user_role)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION pergola_configurator.set_user_role_by_email(text, pergola_configurator.user_role)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION pergola_configurator.is_admin(uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION pergola_configurator.handle_new_user()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.handle_new_auth_user()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.set_user_role(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.set_user_role_by_email(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_role_by_email(text, text) TO service_role;

-- Trigger functions (handle_new_user, handle_new_auth_user) remain owned by postgres;
-- auth signup triggers do not require EXECUTE for anon/authenticated.
