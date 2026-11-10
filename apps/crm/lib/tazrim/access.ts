import { can, isValidRole } from '@/lib/permissions'

/**
 * Tazrim exists only for the real Pashkovsky Group company. NOT the legacy
 * 0000...0001 id from company-context.ts: that row has no members. This is the
 * same id Tazrim's old ALUMINCRM_COMPANY_ID pointed at.
 */
export const PASHKOVSKY_COMPANY_ID = '6998295e-89ae-4e3d-afd2-8c2b0333eac2'

export const TAZRIM_BASE_PATH = '/app/admin/tazrim'

/**
 * Single source of truth for "may this member use Tazrim": the Pashkovsky
 * company AND a role granted `tazrim:view` (owner, admin). Used by the sidebar,
 * page guards and every server action; RLS (057_tazrim_tables.sql) enforces
 * the same rule in the database.
 */
export function canAccessTazrim(
  companyId: string | null | undefined,
  role: string | null | undefined
): boolean {
  if (companyId !== PASHKOVSKY_COMPANY_ID) return false
  if (typeof role !== 'string' || !isValidRole(role)) return false
  return can(role, 'tazrim:view')
}
