-- =============================================================================
-- Migration 055c: stop anon from listing every offer; keep the public gallery
-- NOT APPLIED. Apply only after the smoke below. Independent of 055a/055b/055d.
--
-- offers: drop the two anon SELECT policies that use USING (true).
--   REVOKE SELECT from anon only. Authenticated member policies stay.
--   Every offer route in apps/crm except TodayQueue uses
--   SUPABASE_SERVICE_ROLE_KEY. TodayQueue uses the browser client
--   (anon key + user JWT), so the role is authenticated, not anon.
--   The public approve page and /api/public/offers/[id] use service_role.
--
-- pergola_projects: the gallery is read with the anon key and no user
--   session (apps/site pergulas page and apps/site app/api/pergola-projects).
--   A signed-in visitor on that page is role authenticated, so the policy
--   is TO anon, authenticated. Writes stay revoked. CRM admin routes use
--   service_role (existing "Service role can do everything on pergola_projects").
--
-- ---------------------------------------------------------------------------
-- BEFORE
-- ---------------------------------------------------------------------------
-- SELECT tablename, policyname, roles::text, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('offers','pergola_projects')
-- ORDER BY tablename, policyname;
--
-- SELECT table_name, grantee, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public'
--   AND table_name IN ('offers','pergola_projects')
--   AND grantee IN ('PUBLIC','anon','authenticated','service_role')
-- ORDER BY table_name, grantee, privilege_type;
--
-- AFTER offers: policies "Anon read offer by id" and
--   "Public can read offer by id" are gone. Other offer policy names remain.
--   anon has no SELECT. authenticated still has SELECT.
-- AFTER pergola_projects: one SELECT policy, roles {anon,authenticated}.
--   anon and authenticated have SELECT and not INSERT/UPDATE/DELETE.
--
-- SMOKE (hands):
--   1. Open a real public offer link /[locale]/offers/[id]/approve
--      while logged out. The page renders (service_role on the server).
--   2. In the browser network tab, a direct
--      /rest/v1/offers?select=id with only the anon key returns no rows
--      (or 401), not the full list.
--   3. Signed-in CRM Today queue still shows that user's offers.
--   4. Logged out, /[locale]/pergulas and GET /api/pergola-projects
--      still list the gallery. Repeat once while signed in.
--
-- ---------------------------------------------------------------------------
-- ROLLBACK (emergency only)
-- ---------------------------------------------------------------------------
-- DROP POLICY IF EXISTS "Anon read offer by id" ON public.offers;
-- CREATE POLICY "Anon read offer by id" ON public.offers AS PERMISSIVE FOR SELECT TO anon USING (true);
-- DROP POLICY IF EXISTS "Public can read offer by id" ON public.offers;
-- CREATE POLICY "Public can read offer by id" ON public.offers AS PERMISSIVE FOR SELECT TO anon USING (true);
-- GRANT SELECT ON public.offers TO anon;
--
-- DROP POLICY IF EXISTS "Anon can read marketing gallery" ON public.pergola_projects;
-- DROP POLICY IF EXISTS "Public can read pergola_projects" ON public.pergola_projects;
-- CREATE POLICY "Public can read pergola_projects" ON public.pergola_projects AS PERMISSIVE FOR SELECT TO public USING (true);
-- GRANT SELECT ON public.pergola_projects TO anon, authenticated;
-- =============================================================================

-- offers: only the two anon leaks. Member policies are not dropped.
DROP POLICY IF EXISTS "Anon read offer by id" ON public.offers;
DROP POLICY IF EXISTS "Public can read offer by id" ON public.offers;
REVOKE SELECT ON TABLE public.offers FROM anon;

-- pergola_projects: marketing read for the anon key and for a signed-in JWT.
DROP POLICY IF EXISTS "Public can read pergola_projects" ON public.pergola_projects;
DROP POLICY IF EXISTS "Anon can read marketing gallery" ON public.pergola_projects;
ALTER TABLE public.pergola_projects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pergola_projects FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.pergola_projects FROM anon, authenticated;
GRANT SELECT ON TABLE public.pergola_projects TO anon, authenticated;
GRANT ALL ON TABLE public.pergola_projects TO service_role;

CREATE POLICY "Anon can read marketing gallery"
  ON public.pergola_projects
  FOR SELECT
  TO anon, authenticated
  USING (true);
