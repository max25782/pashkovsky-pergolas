-- =============================================================================
-- Migration 053: tighten EXECUTE grants on public functions
-- Applied: 2026-09-27 (prod)
--
-- Audit findings:
--   All callers are server-side API routes using the service_role Supabase client.
--   No client-side (browser) code calls any of these functions directly via RPC.
--   Restricting to service_role or authenticated does not break any existing call.
--
-- Grants that are NOT changed:
--   - get_early_bird_spots_remaining  (intentionally left as-is)
--   - All trigger functions (RETURNS trigger; not callable via RPC anyway)
--   - record_lead_touch               (new in migration 052, already restricted)
--   - allocate_offer_number           (fixed in migration 052 applied on 2026-09-27)
--
-- Pattern:
--   service_role target → REVOKE FROM PUBLIC, anon, authenticated; GRANT TO service_role
--   authenticated target → REVOKE FROM PUBLIC, anon; GRANT TO authenticated, service_role
--     (service_role is included explicitly so server-side callers remain unaffected)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- service_role only
-- ---------------------------------------------------------------------------

-- check_superadmin_phone: looks up admin email by phone — must never be callable by strangers
REVOKE EXECUTE ON FUNCTION public.check_superadmin_phone(text)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_superadmin_phone(text)
  TO service_role;

-- ensure_company_trial: creates or updates trial subscription — server-only operation
REVOKE EXECUTE ON FUNCTION public.ensure_company_trial(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.ensure_company_trial(uuid)
  TO service_role;

-- ---------------------------------------------------------------------------
-- authenticated (service_role explicitly included so server callers are safe)
-- ---------------------------------------------------------------------------

-- claim_early_bird_spot: SECURITY DEFINER — anon must not claim spots
REVOKE EXECUTE ON FUNCTION public.claim_early_bird_spot(uuid)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.claim_early_bird_spot(uuid)
  TO authenticated, service_role;

-- get_company_settings: not called from any code path currently,
--   but defined as authenticated-safe (reads settings for a company)
REVOKE EXECUTE ON FUNCTION public.get_company_settings(uuid)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_company_settings(uuid)
  TO authenticated, service_role;

-- check_plan_limit: reads subscription limits — no reason for anon access
REVOKE EXECUTE ON FUNCTION public.check_plan_limit(uuid, text)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.check_plan_limit(uuid, text)
  TO authenticated, service_role;

-- has_feature: reads plan feature flags — no reason for anon access
REVOKE EXECUTE ON FUNCTION public.has_feature(uuid, text)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_feature(uuid, text)
  TO authenticated, service_role;

-- has_permission: reads role permissions — no reason for anon access
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, uuid, text, text)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_permission(uuid, uuid, text, text)
  TO authenticated, service_role;

-- increment_usage: writes usage counters — anon must not manipulate billing data
REVOKE EXECUTE ON FUNCTION public.increment_usage(uuid, text, integer)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.increment_usage(uuid, text, integer)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Verification query (run after applying):
-- SELECT routine_name, grantee, privilege_type
-- FROM information_schema.routine_privileges
-- WHERE routine_schema = 'public'
--   AND routine_name IN (
--     'check_superadmin_phone','ensure_company_trial','claim_early_bird_spot',
--     'get_company_settings','check_plan_limit','has_feature',
--     'has_permission','increment_usage'
--   )
-- ORDER BY routine_name, grantee;
-- ---------------------------------------------------------------------------
