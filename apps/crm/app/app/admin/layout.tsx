import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/isSuperAdmin'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Check auth first
  const supabase = createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    // Not authenticated - redirect to login
    redirect('/login?error=authentication_required')
  }

  // Check if user is superadmin
  const isAdmin = await isSuperAdmin(user.id)

  if (!isAdmin) {
    // Not a superadmin - redirect to regular app
    console.log('[AdminLayout] User is not superadmin, redirecting to /app')
    redirect('/app')
  }

  // User is superadmin - allow access
  return <>{children}</>
}

