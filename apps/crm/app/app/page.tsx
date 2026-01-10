import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/isSuperAdmin'

export default async function AppPage() {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  console.log('[AppPage] Auth check - user:', user?.email || 'null', 'error:', authError?.message || 'none')

  if (!user) {
    console.log('[AppPage] No user found, redirecting to login')
    redirect('/login?error=authentication_required')
  }

  // Platform admin goes to platform console.
  const ok = await isSuperAdmin(user.id)
  if (ok) redirect('/superadmin/companies')

  // Company user: must be member of at least one company to use CRM.
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membership) redirect('/app/settings/company?error=no_company')

  // Main CRM landing.
  redirect('/app/admin')
}
