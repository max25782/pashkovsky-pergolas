import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/isSuperAdmin'

export default async function AppPage() {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  // If user is superadmin, redirect to admin panel
  const isAdmin = await isSuperAdmin(user.id)
  if (isAdmin) {
    redirect('/app/admin')
  }

  // Regular user - redirect to their main dashboard (deals)
  redirect('/app/admin/deals')
}

