import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SuperAdminSidebar } from '@/components/superadmin/SuperAdminSidebar'
import { getSession } from '@/lib/session/redis-client'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/isSuperAdmin'

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies()

  // 1) Prefer Redis SuperAdmin session (phone auth)
  const sessionId = cookieStore.get('superadmin_session')?.value
  if (sessionId) {
    const session = await getSession(sessionId)
    if (session && session.role === 'superadmin') {
      return (
        <div className="flex h-screen bg-gray-100" dir="ltr">
          <SuperAdminSidebar />
          <main className="flex-1 overflow-y-auto">
            <div className="container mx-auto px-6 py-8">{children}</div>
          </main>
        </div>
      )
    }
  }

  // 2) Fallback: Supabase cookie session + platform_admins table
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?error=authentication_required')

  const ok = await isSuperAdmin(user.id)
  if (!ok) redirect('/app')

  return (
    <div className="flex h-screen bg-gray-100" dir="ltr">
      <SuperAdminSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  )
}

