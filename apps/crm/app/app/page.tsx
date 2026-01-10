import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/isSuperAdmin'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export default async function AppPage() {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  console.log('[AppPage] Auth check - user:', user?.email || 'null', 'error:', authError?.message || 'none')

  if (!user) {
    console.log('[AppPage] No user found, redirecting to login')
    redirect('/login?error=authentication_required')
  }

  // Platform admin goes to platform console
  const ok = await isSuperAdmin(user.id)
  if (ok) {
    console.log('[AppPage] SuperAdmin detected, redirecting to /superadmin/companies')
    redirect('/superadmin/companies')
  }

  // Check company membership directly (RLS enforced)
  // First check if user has any memberships at all
  const { data: rawMemberships, error: rawError } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .limit(1)

  console.log('[AppPage] Raw memberships check:', {
    count: rawMemberships?.length || 0,
    error: rawError?.message || 'none',
  })

  if (rawError) {
    console.error('[AppPage] Raw membership query error:', rawError)
    redirect('/app/onboarding?error=query_failed')
  }

  if (!rawMemberships || rawMemberships.length === 0) {
    console.log('[AppPage] No memberships found, redirecting to onboarding')
    redirect('/app/onboarding?error=no_company')
  }

  // Try join with companies!inner (RLS enforced)
  const { data: membership, error: membershipError } = await supabase
    .from('company_members')
    .select(
      `
      company_id,
      role,
      companies!inner (
        id,
        name,
        status
      )
    `
    )
    .eq('user_id', user.id)
    .order('created_at', { foreignTable: 'companies', ascending: false })
    .limit(1)
    .maybeSingle()

  console.log('[AppPage] Membership join check:', {
    hasMembership: !!membership,
    error: membershipError?.message || 'none',
    companyId: membership?.company_id || 'none',
  })

  // If join succeeded, user has access to at least one company
  if (membership && membership.companies) {
    // Ensure trial subscription exists (idempotent, non-blocking)
    try {
      const serviceClient = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      )

      // Call PostgreSQL function directly (idempotent)
      const { error: rpcError } = await serviceClient.rpc('ensure_company_trial', {
        p_user_id: user.id,
      })

      if (rpcError) {
        console.warn('[AppPage] ensure_company_trial failed (non-critical):', rpcError)
      }
    } catch (err) {
      console.warn('[AppPage] Trial ensure error (non-critical):', err)
    }

    console.log('[AppPage] Company found via join:', membership.company_id, 'redirecting to /app/admin')
    redirect('/app/admin')
  }

  // If join failed but we have raw memberships, RLS is blocking access
  // This is a valid state - user has membership but no access to company data
  // Redirect to onboarding so they can contact admin
  console.log('[AppPage] Join failed but memberships exist - RLS blocking, redirecting to onboarding')
  redirect('/app/onboarding?error=rls_blocked')
}
