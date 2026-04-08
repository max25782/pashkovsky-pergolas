'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCRMTranslations } from '@/components/admin/useCRMTranslations'
import { useTranslations } from 'next-intl'
import { DealsStatistics } from '@/components/admin/DealsStatistics'
import type { Deal } from '@/components/admin/deal-types'
import { createClient } from '@/lib/supabase/client'

export default function StatisticsPage() {
  const t = useCRMTranslations()
  const tStats = useTranslations('statistics')
  const router = useRouter()
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)

  useEffect(() => {
    async function loadDeals() {
      try {
        setLoading(true)
        
        const supabase = createClient()
        
        const { data, error: dbError } = await supabase
          .from('deals')
          .select('*')
          .or('source.is.null,source.neq.quick_offer')
          .order('created_at', { ascending: false })
          .limit(1000)
        
        
        if (dbError) {
          console.error('[Statistics] DB error:', dbError)
          setError(dbError.message)
          return
        }
        
        setDeals(data || [])
      } catch (e: unknown) {
        console.error('[Statistics] Error:', e)
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    }
    
    loadDeals()
  }, [])

  function handleDealClick(deal: Deal) {
    // Redirect to deals page with dealId query parameter
    router.push(`/app/admin/deals?dealId=${deal.id}`)
  }

  return (
    <main className="container py-8 text-white">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-xl sm:text-3xl font-bold">Admin • {t.nav.statistic}</h1>
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/app/admin/deals"
            className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 font-semibold"
          >
            {t.nav.deals}
          </Link>
          <Link
            href="/app/admin/statistics"
            className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 font-semibold"
          >
            {t.nav.statistic}
          </Link>
          <Link
            href="/app/admin/leads"
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 font-semibold"
          >
            {t.nav.leads}
          </Link>
          <Link
            href="/app/admin/gallery"
            className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 font-semibold"
          >
            {t.nav.gallery}
          </Link>
          <Link
            href="/app/admin/ai-chats"
            className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-700 font-semibold"
          >
            {t.nav.aiChats}
          </Link>
          <Link
            href="/app/admin/articles"
            className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 font-semibold"
          >
            {t.nav.articles}
          </Link>
          <Link
            href="/app/admin/workers"
            className="px-4 py-2 rounded bg-yellow-600 hover:bg-yellow-700 font-semibold"
          >
            {t.nav.workers}
          </Link>
          <Link
            href="/app/admin/reports/monthly"
            className="px-4 py-2 rounded bg-orange-600 hover:bg-orange-700 font-semibold"
          >
            {t.nav.reports}
          </Link>
          <Link
            href="/app/admin/reports/weekly"
            className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 font-semibold"
          >
            {tStats('weeklyDigests')}
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-white/60">{tStats('loading')}</div>
      ) : error ? (
        <div className="text-center py-12 text-red-400">{error}</div>
      ) : (
        <DealsStatistics 
          deals={deals} 
          onDealClick={handleDealClick}
        />
      )}
    </main>
  )
}

