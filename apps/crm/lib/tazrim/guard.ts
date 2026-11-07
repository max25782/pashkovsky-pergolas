import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessTazrim, PASHKOVSKY_COMPANY_ID } from './access'

/** User-session Supabase client: every Tazrim query runs under RLS. */
export type TazrimSupabase = ReturnType<typeof createClient>

export interface TazrimContext {
  supabase: TazrimSupabase
  userId: string
  companyId: string
  role: string
}

export class TazrimForbiddenError extends Error {
  constructor() {
    super('Forbidden: Tazrim is available to owner/admin of the Pashkovsky company only')
    this.name = 'TazrimForbiddenError'
  }
}

/**
 * Resolve the signed-in user's Pashkovsky membership and check Tazrim access.
 * Returns null when signed out, not a member of the Pashkovsky company, or the
 * role is not owner/admin. Membership is looked up for the Pashkovsky company
 * specifically (not "first company"), so multi-company users cannot slip by.
 */
export async function getTazrimContext(): Promise<TazrimContext | null> {
  const supabase = createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) return null

  const { data: membership, error: membershipError } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('company_id', PASHKOVSKY_COMPANY_ID)
    .maybeSingle()
  if (membershipError) {
    console.error('[tazrim] membership lookup failed:', membershipError.message)
    return null
  }
  if (!membership) return null

  const companyId = String(membership.company_id)
  const role = String(membership.role)
  if (!canAccessTazrim(companyId, role)) return null

  return { supabase, userId: user.id, companyId, role }
}

/**
 * For pages and layouts: redirect away when access is denied. The layout of
 * /app/admin sends signed-out users to the login page.
 */
export async function requireTazrimAccess(): Promise<TazrimContext> {
  const ctx = await getTazrimContext()
  if (!ctx) redirect('/app/admin')
  return ctx
}

/** For server actions: they are public POST endpoints, so always throw when denied. */
export async function requireTazrimActionContext(): Promise<TazrimContext> {
  const ctx = await getTazrimContext()
  if (!ctx) throw new TazrimForbiddenError()
  return ctx
}
