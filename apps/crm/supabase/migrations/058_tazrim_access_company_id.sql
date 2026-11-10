-- 058_tazrim_access_company_id.sql
--
-- Fix for 057: tz_has_access() was first applied with the legacy company id
-- 0000...0001, which has no members, so RLS denied everyone. Tazrim belongs to
-- the real Pashkovsky Group company (same id the old Tazrim used as
-- ALUMINCRM_COMPANY_ID). Keep in sync with lib/tazrim/access.ts.
--
-- 057 itself was updated to the correct id for fresh environments; this
-- migration repairs databases where the old version was already applied.
-- Idempotent.

CREATE OR REPLACE FUNCTION public.tz_has_access(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_company_id = '6998295e-89ae-4e3d-afd2-8c2b0333eac2'::uuid
    AND EXISTS (
      SELECT 1
      FROM public.company_members m
      WHERE m.user_id = auth.uid()
        AND m.company_id = p_company_id
        AND m.role IN ('owner', 'admin')
    );
$$;

REVOKE ALL ON FUNCTION public.tz_has_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tz_has_access(uuid) TO authenticated, service_role;
