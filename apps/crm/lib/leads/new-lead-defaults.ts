/**
 * Resolves default values for newly created leads:
 *   - lead_owner_id: the company's owner (role = 'owner', oldest first)
 *   - next_action_at: now (so the lead appears in the "היום" queue immediately)
 *
 * The owner lookup result is cached per Node.js process lifetime.
 * In serverless (Vercel), each cold start re-fetches — acceptable.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

const ownerCache = new Map<string, string>()

/**
 * Returns the user_id of the company owner, or null if not found.
 * Cached per company_id within the process.
 */
/**
 * Resolve the salesperson to assign new inbound leads to.
 * Priority: salesperson role first (oldest by created_at as tiebreak if multiple),
 * fallback to owner if no salesperson exists.
 */
export async function resolveLeadOwner(
  supabase: SupabaseClient,
  companyId: string,
): Promise<string | null> {
  const cached = ownerCache.get(companyId)
  if (cached) return cached

  // Prefer salesperson over owner
  const { data } = await supabase
    .from('company_members')
    .select('user_id, role')
    .eq('company_id', companyId)
    .in('role', ['salesperson', 'owner'])
    .order('created_at', { ascending: true })

  const rows = data ?? []
  // salesperson first, then owner
  const salesperson = rows.find(r => r.role === 'salesperson')
  const owner = rows.find(r => r.role === 'owner')
  const resolved = (salesperson ?? owner)?.user_id ?? null

  if (resolved) ownerCache.set(companyId, resolved)
  return resolved
}

/**
 * Returns the fields that every new inbound lead should receive.
 * Call once per insert; pass company_id so it works multi-tenant.
 */
export async function newLeadDefaults(
  supabase: SupabaseClient,
  companyId: string,
): Promise<{ lead_owner_id: string | null; next_action_at: string }> {
  const lead_owner_id = await resolveLeadOwner(supabase, companyId)
  const next_action_at = new Date().toISOString()
  return { lead_owner_id, next_action_at }
}
