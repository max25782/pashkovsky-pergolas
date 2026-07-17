-- ============================================================
-- Fix: Security Advisor errors in pergola_configurator schema
-- ============================================================
-- Three issues reported by Supabase Security Advisor:
--
-- 1. ERROR  - pergola_configurator.leads
--             "Policy Exists RLS Disabled"
--             Policies (leads_admin_manager_all, leads_owner_insert,
--             leads_owner_select, leads_owner_update, …) already exist
--             but ALTER TABLE … ENABLE ROW LEVEL SECURITY was never run.
--             FIX: one line below — enables filtering without touching policies.
--
-- 2. ERROR  - pergola_configurator.pergola_configurator_uploads
--             "RLS Disabled in Public"
--             Table has no RLS and no policies at all.
--             FIX: enable RLS + service-role-only policies (safe default).
--
-- 3. WARNING - pergola_configurator.rw_project_margins
--             "Security Definer View"
--             View runs as its owner, bypassing RLS for callers.
--             FIX: ALTER VIEW … SET (security_invoker = on)
--             Works in PostgreSQL ≥15 without knowing the view definition.
-- ============================================================


-- ── 1. Enable RLS on leads (policies already exist) ──────────────────────────
--
-- This single statement activates all pre-existing policies.
-- No data is lost; no policies are dropped or changed.
-- Before this runs: every SELECT on the table returns ALL rows regardless of
-- the policies. After: only rows allowed by the policies are returned.

ALTER TABLE pergola_configurator.leads ENABLE ROW LEVEL SECURITY;


-- ── 2. Enable RLS on pergola_configurator_uploads ─────────────────────────────
--
-- The uploads table stores files or references uploaded via the configurator.
-- We don't know whether it has company_id / user_id columns, so we use the
-- safest possible default:
--   • service_role (the backend API key) → full unrestricted access.
--   • Direct authenticated / anonymous queries → blocked.
--
-- This means the table continues to work exactly as before through the API
-- (which uses the service_role key), while closing the open security hole
-- where any authenticated user could query or modify any row directly.
--
-- If you later add a user_id or company_id column and need row-scoped access,
-- drop "uploads_service_role_all" and add the appropriate policies.

ALTER TABLE pergola_configurator.pergola_configurator_uploads ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any were created outside migrations
DROP POLICY IF EXISTS "uploads_service_role_all" ON pergola_configurator.pergola_configurator_uploads;

-- Service role bypass: full access for the backend (POST /api/…, CRM, etc.)
CREATE POLICY "uploads_service_role_all"
  ON pergola_configurator.pergola_configurator_uploads
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ── 3. Fix Security Definer view ──────────────────────────────────────────────
--
-- A SECURITY DEFINER view runs with the privileges of the view's OWNER,
-- not the caller.  This effectively bypasses RLS for anyone who can SELECT
-- from the view, even if the underlying tables have RLS enabled.
--
-- Setting security_invoker = on makes the view run as the CALLER instead,
-- so the caller's own RLS policies (and role privileges) apply — exactly
-- the same as if they had queried the base table directly.
--
-- Wrapped in a DO block so the migration does not fail if the view was
-- renamed or dropped since the Security Advisor ran its scan.

DO $$
DECLARE
  v_schema text := 'pergola_configurator';
  v_view   text := 'rw_project_margins';
BEGIN
  IF EXISTS (
    SELECT 1
    FROM   information_schema.views
    WHERE  table_schema = v_schema
      AND  table_name   = v_view
  ) THEN
    EXECUTE format(
      'ALTER VIEW %I.%I SET (security_invoker = on)',
      v_schema, v_view
    );
    RAISE NOTICE 'security_invoker enabled on %.%', v_schema, v_view;
  ELSE
    RAISE NOTICE 'View %.% not found — skipping (already dropped or renamed?)',
      v_schema, v_view;
  END IF;
END $$;
