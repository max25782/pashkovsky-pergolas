import { createClient } from '@supabase/supabase-js'
import { isSuperAdmin } from '@/lib/auth/isSuperAdmin'
import { normalizePlan } from '@/lib/subscription/plan-access'
import type { SubscriptionPlan } from '@/lib/subscription/plan-types'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase =
  SUPABASE_URL && SERVICE_KEY
    ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
    : undefined

/**
 * Resolved SaaS plan for API / gating. Platform super-admins always get full access.
 * Team members keep their own plan row — salesperson access is role-based, not plan-based.
 */
export async function getUserSubscriptionPlan(userId: string): Promise<SubscriptionPlan> {
  if (!userId) return 'offer'
  if (await isSuperAdmin(userId)) return 'growth'
  if (!supabase) return 'offer'

  const { data, error } = await supabase.from('users').select('plan').eq('id', userId).maybeSingle()

  if (error || !data) return 'offer'
  return normalizePlan((data as { plan?: string }).plan)
}

/** Role in the user's primary company (same company_id as owner — not a separate tenant). */
export async function getUserCompanyRole(userId: string): Promise<string | null> {
  if (!supabase || !userId) return null

  const { data: membership } = await supabase
    .from('company_members')
    .select('role')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return membership?.role ?? null
}
