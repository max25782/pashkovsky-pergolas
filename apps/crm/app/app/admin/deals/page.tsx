"use client"
import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DealsTable } from '@/components/admin/DealsTable'
import { useCRMTranslations } from '@/components/admin/useCRMTranslations'

function DealsPageContent() {
  const t = useCRMTranslations()
  const searchParams = useSearchParams()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  
  // Get dealId from URL query parameter
  const dealId = searchParams?.get('dealId') || undefined

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        setIsAuthenticated(true)
      } else {
        window.location.href = '/login'
      }
    } catch (err) {
      console.error('[DealsPage] Auth check error:', err)
      window.location.href = '/login'
    } finally {
      setIsChecking(false)
    }
  }

  if (isChecking) {
    return (
      <main className="container py-16 text-white">
        <div className="max-w-md mx-auto text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white/60">Checking authentication...</p>
        </div>
      </main>
    )
  }

  if (!isAuthenticated) {
    return null // Will redirect to /login
  }

  return (
    <main className="container h-full py-6 text-white flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">{t.deals.title}</h1>
        <Link 
          href="/app/admin"
          className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 transition"
        >
          ← {t.common.back}
        </Link>
      </div>
      
      <div className="flex-1 min-h-0">
        <DealsTable initialDealId={dealId} />
      </div>
    </main>
  )
}

export default function AdminDealsPage() {
  return (
    <Suspense fallback={
      <main className="container py-16 text-white">
        <div className="max-w-md mx-auto text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white/60">Loading...</p>
        </div>
      </main>
    }>
      <DealsPageContent />
    </Suspense>
  )
}
