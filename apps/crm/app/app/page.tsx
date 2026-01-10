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

    // Step 3: Quick membership check (minimal query to avoid blocking)
    console.log('[AppPage] Quick membership check')
    const { data: rawMemberships, error: rawError } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    console.log('[AppPage] Raw membership check:', {
      hasMembership: !!rawMemberships,
      error: rawError?.message || 'none',
    })

    if (rawError) {
      console.error('[AppPage] Raw membership query error:', rawError)
      redirect('/app/onboarding?error=query_failed')
    }

    if (!rawMemberships) {
      console.log('[AppPage] No memberships found, redirecting to onboarding')
      redirect('/app/onboarding?error=no_company')
    }

    // Step 4: Immediate redirect to /app/admin (let admin layout handle full check)
    // This prevents layout from preloading all sidebar links
    console.log('[AppPage] Membership found, redirecting to /app/admin')
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
