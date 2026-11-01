-- =============================================================================
-- Migration 055d: RPC EXECUTE on role helpers
-- NOT APPLIED. Do not run until approved. Independent of 055a/055b/055c.
-- Idempotent where the function exists. A missing function is skipped.
--
-- Grep of apps, packages, supabase/functions, scripts, infrastructure,
-- mcp-servers, .github: no .rpc('set_user_role'), .rpc('set_user_role_by_email'),
-- .rpc('is_admin'), or .rpc('handle_new_user').
-- handle_new_auth_user is a trigger on auth.users
-- (apps/crm/app/api/auth/register/route.ts comment; baseline trigger
-- on_auth_user_created). Triggers do not consult the caller's EXECUTE grant.
--
-- is_admin stays executable by authenticated.
--   pergola_configurator.is_admin(uuid) is SECURITY DEFINER
--   (schema_baseline_2026-08-08.sql). The invoker still needs EXECUTE.
--   Two policies call it as the signed-in user:
--     profiles_admin_read_all    FOR SELECT TO authenticated
--       USING (pergola_configurator.is_admin(auth.uid()))
--     profiles_admin_update_all  FOR UPDATE TO authenticated
--       USING / WITH CHECK (pergola_configurator.is_admin(auth.uid()))
--   No policy calls is_admin for anon. REVOKE FROM PUBLIC would also remove
--   authenticated when that role's only grant is PUBLIC, so EXECUTE is
--   granted back to authenticated and to service_role.
--   056 keeps profiles_admin_update_all. It still needs this grant.
--
-- ---------------------------------------------------------------------------
-- BEFORE / AFTER (same query as migration 054)
-- ---------------------------------------------------------------------------
-- SELECT routine_schema, routine_name, grantee, privilege_type
-- FROM information_schema.routine_privileges
-- WHERE routine_name IN (
--     'set_user_role','set_user_role_by_email','is_admin',
--     'handle_new_user','handle_new_auth_user'
--   )
--   AND grantee IN ('PUBLIC','anon','authenticated','service_role')
-- ORDER BY routine_schema, routine_name, grantee;
--
-- AFTER:
--   set_user_role, set_user_role_by_email, handle_new_user, handle_new_auth_user:
--     no PUBLIC / anon / authenticated; service_role remains.
--   pergola_configurator.is_admin: authenticated and service_role, not anon.
--
-- SMOKE: sign up a new auth user (trigger still inserts the profile / public.users).
--   Sign in as a non-admin and open a configurator page that reads profiles.
--   Sign in as an admin and confirm profiles_admin_read_all still returns rows.
--   From the browser, supabase.rpc('set_user_role', ...) returns 401/42501.
--
-- ---------------------------------------------------------------------------
-- ROLLBACK (emergency only; restores PUBLIC execute)
-- ---------------------------------------------------------------------------
-- GRANT EXECUTE ON FUNCTION pergola_configurator.set_user_role(uuid, pergola_configurator.user_role) TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION pergola_configurator.set_user_role_by_email(text, pergola_configurator.user_role) TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION pergola_configurator.is_admin(uuid) TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION pergola_configurator.handle_new_user() TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO PUBLIC, anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, text) TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.set_user_role_by_email(text, text) TO PUBLIC;
-- =============================================================================

DO $$
BEGIN
  IF to_regprocedure('pergola_configurator.set_user_role(uuid, pergola_configurator.user_role)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION pergola_configurator.set_user_role(uuid, pergola_configurator.user_role) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION pergola_configurator.set_user_role(uuid, pergola_configurator.user_role) TO service_role;
  END IF;

  IF to_regprocedure('pergola_configurator.set_user_role_by_email(text, pergola_configurator.user_role)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION pergola_configurator.set_user_role_by_email(text, pergola_configurator.user_role) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION pergola_configurator.set_user_role_by_email(text, pergola_configurator.user_role) TO service_role;
  END IF;

  -- Keep authenticated: profiles_admin_read_all and profiles_admin_update_all call this.
  IF to_regprocedure('pergola_configurator.is_admin(uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION pergola_configurator.is_admin(uuid) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION pergola_configurator.is_admin(uuid) TO authenticated, service_role;
  END IF;

  IF to_regprocedure('pergola_configurator.handle_new_user()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION pergola_configurator.handle_new_user() FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION pergola_configurator.handle_new_user() TO service_role;
  END IF;

  IF to_regprocedure('public.handle_new_auth_user()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO service_role;
  END IF;

  IF to_regprocedure('public.set_user_role(uuid, text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.set_user_role(uuid, text) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, text) TO service_role;
  END IF;

  IF to_regprocedure('public.set_user_role_by_email(text, text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.set_user_role_by_email(text, text) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.set_user_role_by_email(text, text) TO service_role;
  END IF;
END
$$;
