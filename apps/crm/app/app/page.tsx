import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/isSuperAdmin'
import { getUserSubscriptionPlan } from '@/lib/subscription/load-user-plan'
import { hasAccess } from '@/lib/subscription/plan-access'

export const dynamic = 'force-dynamic'

export default async function AppPage() {
  try {
    // Step 1: Check authentication
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login?error=auth_required')
    }

    // Step 2: Check SuperAdmin
    const ok = await isSuperAdmin(user.id)
    if (ok) {
      redirect('/superadmin/companies')
    }

    // Step 3: Quick membership check
    const { data: rawMemberships, error: rawError } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (rawError) {
      console.error('[AppPage] Membership query error:', rawError)
      redirect('/app/onboarding?error=query_failed')
    }

    if (!rawMemberships) {
      redirect('/app/onboarding?error=no_company')
    }

    const plan = await getUserSubscriptionPlan(user.id)
    if (!hasAccess({ plan }, 'crm_home')) {
      redirect('/app/quick-offer')
    }

    redirect('/app/admin')

  } catch (error: unknown) {
    const e = error as { digest?: string; message?: string } | undefined
    // next/navigation redirect() throws NEXT_REDIRECT — let it propagate normally
    if (e?.digest?.startsWith('NEXT_REDIRECT')) throw error

    console.error('[AppPage] Unexpected error:', e?.message ?? error)
    throw error
  }
}
