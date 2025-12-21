'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Locale } from '@/lib/locales'
import { useCRMTranslations } from '@/components/admin/useCRMTranslations'
import { useDeals } from '@/components/admin/hooks/useDeals'
import { DealsStatistics } from '@/components/admin/DealsStatistics'
import type { Deal } from '@/components/admin/deal-types'

export default function StatisticsPage(()) {
  const t = useCRMTranslations()
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)

  useEffect(() => {
    const storedToken = localStorage.getItem('admin_token')
    if (storedToken) setToken(storedToken)
  }, [])

  const { deals, loading, error } = useDeals({
    adminToken: token || '',
    searchQuery: '',
    stageFilter: '',
    projectTypeFilter: '',
    page: 0,
    limit: 1000 // Get all deals for statistics
  })

  function save() {
    if (input.trim()) {
      localStorage.setItem('admin_token', input.trim())
      setToken(input.trim())
    }
  }

  function logout() {
    localStorage.removeItem('admin_token')
    setToken(null)
    setInput('')
  }

  function handleDealClick(deal: Deal) {
    // Redirect to deals page - the deal will be opened there
    router.push(`/${params.locale}/admin/deals`)
  }

  if (!token) {
    return (
      <main className="container py-16 text-white">
        <h1 className="text-2xl font-bold mb-4">Admin • {t.nav.statistic}</h1>
        <div className="max-w-md bg-white/5 border border-white/10 rounded-xl p-6">
          <label className="block text-sm mb-2">{t.auth.enterAdminToken}</label>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            className="w-full px-3 py-2 rounded bg-black/40 border border-white/20"
            placeholder={t.auth.adminTokenPlaceholder}
          />
          <button onClick={save} className="mt-3 px-4 py-2 rounded bg-white/10 hover:bg-white/20">
            {t.common.continue}
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="container py-8 text-white">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Admin • {t.nav.statistic}</h1>
        <div className="flex gap-2 flex-wrap">
          <Link
            href={`/${params.locale}/admin/deals`}
            className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 font-semibold"
          >
            {t.nav.deals}
          </Link>
          <Link
            href={`/${params.locale}/admin/statistics`}
            className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 font-semibold"
          >
            {t.nav.statistic}
          </Link>
          <Link
            href={`/${params.locale}/admin/leads`}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 font-semibold"
          >
            {t.nav.leads}
          </Link>
          <Link
            href={`/${params.locale}/admin/gallery`}
            className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 font-semibold"
          >
            {t.nav.gallery}
          </Link>
          <Link
            href={`/${params.locale}/admin/ai-chats`}
            className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-700 font-semibold"
          >
            {t.nav.aiChats}
          </Link>
          <Link
            href={`/${params.locale}/admin/articles`}
            className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 font-semibold"
          >
            {t.nav.articles}
          </Link>
          <Link
            href={`/${params.locale}/admin/workers`}
            className="px-4 py-2 rounded bg-yellow-600 hover:bg-yellow-700 font-semibold"
          >
            {t.nav.workers}
          </Link>
          <Link
            href={`/${params.locale}/admin/reports/monthly`}
            className="px-4 py-2 rounded bg-orange-600 hover:bg-orange-700 font-semibold"
          >
            {t.nav.reports}
          </Link>
          <Link
            href={`/${params.locale}/admin/reports/weekly`}
            className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 font-semibold"
          >
            Weekly Digests
          </Link>
          <button onClick={logout} className="px-3 py-2 rounded bg-white/10 hover:bg-white/20">
            {t.common.logout}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-white/60">טוען נתונים...</div>
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

