"use client"
import Link from 'next/link'
import { Lock } from 'lucide-react'
import { LeadsTable } from '@/components/admin/LeadsTable'
import { useCRMTranslations } from '@/components/admin/useCRMTranslations'
import { useSubscriptionPlan } from '@/components/subscription/subscription-plan-context'

export default function AdminLeadsPage(){
  const t = useCRMTranslations()
  const { can, loading: planLoading } = useSubscriptionPlan()

  if (!planLoading && !can('leads')) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-950">
        <div className="text-center p-8">
          <Lock className="h-12 w-12 text-neutral-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Business Plan Required</h2>
          <p className="text-neutral-400">Leads are available on the Business plan and above.</p>
        </div>
      </div>
    )
  }

  return (
    <main className="container py-8 text-white">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h1 className="text-xl sm:text-2xl font-bold">Admin • {t.leads.title}</h1>
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
        </div>
      </div>
      <LeadsTable />
    </main>
  )
}


