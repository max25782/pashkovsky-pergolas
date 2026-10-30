-- =============================================================================
-- Migration 054: Security Advisor — offer_number_counters RLS + vw_project_margins
-- NOT APPLIED until explicitly approved (prod: kvqupacmdishpfnscnio).
--
-- Fixes:
--   ERROR  rls_disabled_in_public     → public.offer_number_counters
--   ERROR  security_definer_view      → pergola_configurator.vw_project_margins
--
-- ---------------------------------------------------------------------------
-- BEFORE APPLY (local / staging)
-- ---------------------------------------------------------------------------
-- 1. Confirm quick-offer uses service_role, not anon/authenticated:
--      grep SUPABASE_SERVICE_ROLE_KEY apps/crm/app/api/quick-offer/route.ts
--      createClient(..., SERVICE_KEY) — must be present; no browser client on counters/RPC.
-- 2. Local Supabase up, then:
--      cd apps/crm && npm test -- lib/offers/__tests__/allocate-offer-number.race.test.ts
--      (optional) npx tsx scripts/run-allocate-race.ts
-- 3. Smoke: POST /api/quick-offer → offer_number YYYY-#### increments.
--
-- AFTER APPLY (prod)
-- ---------------------------------------------------------------------------
-- Re-run Supabase Dashboard → Database → Security Advisor (or get_advisors security).
-- Expect: 0 ERROR for these two items; INFO +1 rls_enabled_no_policy on offer_number_counters.
--
-- ---------------------------------------------------------------------------
-- ROLLBACK (run manually if needed; do not apply forward + rollback in one go)
-- ---------------------------------------------------------------------------
-- -- offer_number_counters
-- ALTER TABLE public.offer_number_counters DISABLE ROW LEVEL SECURITY;
-- GRANT ALL ON TABLE public.offer_number_counters TO anon, authenticated;
--
-- -- vw_project_margins
-- ALTER VIEW pergola_configurator.vw_project_margins SET (security_invoker = false);
-- GRANT SELECT, INSERT, UPDATE, DELETE ON pergola_configurator.vw_project_margins TO anon, authenticated;
--
-- RPC grants (unchanged by forward; re-assert only if someone widened EXECUTE):
-- REVOKE ALL ON FUNCTION public.allocate_offer_number(uuid, integer) FROM PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.allocate_offer_number(uuid, integer) TO service_role;
-- =============================================================================

-- ── 1. offer_number_counters: deny direct PostgREST access; keep server RPC path ──
--
-- App path: POST /api/quick-offer → service_role client → allocate_offer_number (SECURITY DEFINER).
-- Function owner (postgres) writes counters; service_role bypasses RLS. No anon/authenticated policies.

ALTER TABLE public.offer_number_counters ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.offer_number_counters FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.offer_number_counters TO service_role;

-- Idempotent: production should already match migration 050 / 053; safe to re-run.
REVOKE ALL ON FUNCTION public.allocate_offer_number(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.allocate_offer_number(uuid, integer) TO service_role;

-- ── 2. vw_project_margins: caller RLS on pergola_configurator.projects ──

DO $$
DECLARE
  v_schema text := 'pergola_configurator';
  v_view   text := 'vw_project_margins';
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.views
    WHERE table_schema = v_schema
      AND table_name   = v_view
  ) THEN
    EXECUTE format(
      'ALTER VIEW %I.%I SET (security_invoker = true)',
      v_schema, v_view
    );
    RAISE NOTICE 'security_invoker enabled on %.%', v_schema, v_view;
  ELSE
    RAISE NOTICE 'View %.% not found — skipping', v_schema, v_view;
  END IF;
END $$;

REVOKE ALL ON pergola_configurator.vw_project_margins FROM anon;

-- authenticated: leave SELECT if legacy configurator reads margins as signed-in user (RLS via invoker).
-- To fully lock down client access, uncomment:
-- REVOKE ALL ON pergola_configurator.vw_project_margins FROM authenticated;
-- GRANT SELECT ON pergola_configurator.vw_project_margins TO authenticated;
