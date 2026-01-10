import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/isSuperAdmin'

export const dynamic = 'force-dynamic'

export default async function AppPage() {
  try {
    console.log('[AppPage] Starting page render')

    // Step 1: Check authentication
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    console.log('[AppPage] Auth check - user:', user?.email || 'null', 'error:', authError?.message || 'none')

    if (!user) {
      console.log('[AppPage] No user found, redirecting to login')
      redirect('/login?error=auth_required')
    }

    // Step 2: Check SuperAdmin
    console.log('[AppPage] Checking SuperAdmin status')
    const ok = await isSuperAdmin(user.id)
    if (ok) {
      console.log('[AppPage] SuperAdmin detected, redirecting to /superadmin/companies')
      redirect('/superadmin/companies')
    }

    // Step 3: Check company membership directly (RLS enforced)
    console.log('[AppPage] Checking company membership')
    
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

    // Step 4: Handle membership result
    if (membershipError) {
      console.error('[AppPage] Membership query error:', membershipError)
      redirect('/app/onboarding?error=query_failed')
    }

    if (!membership || !membership.companies) {
      console.log('[AppPage] Join failed but memberships exist - RLS blocking, redirecting to onboarding')
      redirect('/app/onboarding?error=rls_blocked')
    }

    console.log('[AppPage] Company found:', membership.company_id)
    
    // Step 7: Ensure trial subscription (non-blocking, idempotent)
    try {
      const { createClient: createServiceClient } = await import('@supabase/supabase-js')
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

      const { error: rpcError } = await serviceClient.rpc('ensure_company_trial', {
        p_user_id: user.id,
      })

      if (rpcError) {
        console.warn('[AppPage] ensure_company_trial failed (non-critical):', rpcError)
      } else {
        console.log('[AppPage] Trial ensured successfully')
      }
    } catch (trialError: any) {
      console.warn('[AppPage] Trial ensure error (non-critical):', trialError)
      // Don't fail the redirect if trial creation fails
    }

    // Step 8: Final redirect (always executed)
    console.log('[AppPage] Final redirect to /app/admin')
    redirect('/app/admin')

  } catch (error: any) {
    // Log fatal error
    console.error('[AppPage] Fatal error:', error)
    console.error('[AppPage] Error stack:', error.stack)
    console.error('[AppPage] Error message:', error.message)
    
    // Re-throw to trigger error.tsx boundary
    throw error
  }
}
