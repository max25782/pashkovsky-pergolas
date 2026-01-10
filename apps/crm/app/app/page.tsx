import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/isSuperAdmin'

export default async function AppPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?error=authentication_required')

  // /app/admin is SuperAdmin-only (platform_admins). Normal users must not loop into it.
  const ok = await isSuperAdmin(user.id)
  if (ok) redirect('/app/admin')

  // Normal (non-platform-admin) landing.
  // Keep it inside /app (not /app/admin) to avoid redirect loops.
  redirect('/app/settings/company')
}
