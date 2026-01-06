'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AppPage() {
  const router = useRouter()

  useEffect(() => {
    checkAuthAndRedirect()
  }, [])

  async function checkAuthAndRedirect() {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      router.push('/login')
      return
    }

    // Check if user is superadmin
    try {
      const response = await fetch('/api/auth/check-superadmin')
      const data = await response.json()

      if (data.isSuperAdmin) {
        router.push('/app/admin')
      } else {
        router.push('/app/admin/deals')
      }
    } catch {
      // Default to deals page
      router.push('/app/admin/deals')
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  )
}
