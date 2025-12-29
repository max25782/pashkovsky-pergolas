/**
 * SuperAdmin Layout
 * Protected layout - only platform admins can access
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SuperAdminSidebar } from '@/components/superadmin/SuperAdminSidebar'

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check SuperAdmin session from server (via httpOnly cookie)
    async function checkSession() {
      try {
        const response = await fetch('/api/auth/superadmin-session', {
          method: 'GET',
          credentials: 'include', // Important: include cookies
        })

        const data = await response.json()

        if (!response.ok || !data.authenticated) {
          console.log('[SuperAdmin Layout] Not authenticated:', data.error)
          router.push('/login?error=unauthorized')
          return
        }

        console.log('[SuperAdmin Layout] ✓ Authenticated:', data.user.email)
        setIsAuthenticated(true)
      } catch (error) {
        console.error('[SuperAdmin Layout] Session check error:', error)
        router.push('/login?error=session_check_failed')
      } finally {
        setIsLoading(false)
      }
    }

    checkSession()
  }, [router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying access...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null // Will redirect
  }

  return (
    <div className="flex h-screen bg-gray-100" dir="ltr">
      {/* Sidebar */}
      <SuperAdminSidebar />
      
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}

