'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { authFetch } from '@/lib/api/auth-fetch'
import { useToast } from '@/components/ui/toast'
import { useTranslations } from 'next-intl'
import { useCRMTranslations } from '@/components/admin/useCRMTranslations'
import type { PensionReport } from '@/lib/workers/pension-report'

function formatIls(value: number): string {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 2,
  }).format(value)
}

export default function WorkersPensionPage() {
  const t = useCRMTranslations()
  const tWorkers = useTranslations('workers')
  const toast = useToast()
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [report, setReport] = useState<PensionReport | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch(`/api/workers/pension?month=${month}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? tWorkers('pensionLoadError'))
      }
      setReport(await res.json() as PensionReport)
    } catch (error) {
      setReport(null)
      toast.error(error instanceof Error ? error.message : tWorkers('pensionLoadError'))
    } finally {
      setLoading(false)
    }
  }, [month, tWorkers, toast])

  useEffect(() => { load() }, [load])

  return (
    <main className="container py-8 text-white">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold mb-1">{tWorkers('pensionTitle')}</h1>
            <p className="text-white/60">{tWorkers('pensionSubtitle')}</p>
          </div>
          <Link
            href="/app/admin/workers"
            className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 font-semibold"
          >
            {t.nav.workers}
          </Link>
        </div>

        <label className="flex items-center gap-2 mb-4">
          <span className="text-white/70">{tWorkers('pensionMonth')}</span>
          <input
            type="month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            className="px-3 py-2 rounded bg-white/10 border border-white/20 text-white"
          />
        </label>

        <div className="bg-white/5 border border-white/10 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/10 text-white/70">
              <tr>
                <th className="p-3 text-right">{tWorkers('pensionColWorker')}</th>
                <th className="p-3 text-right">{tWorkers('pensionColDays')}</th>
                <th className="p-3 text-right">{tWorkers('pensionColGross')}</th>
                <th className="p-3 text-right">{tWorkers('pensionColPension')}</th>
              </tr>
            </thead>
            <tbody>
              {(report?.rows ?? []).map((row) => (
                <tr key={row.workerId} className="border-t border-white/10">
                  <td className="p-3">{row.workerName}</td>
                  <td className="p-3">{row.days}</td>
                  <td className="p-3">{formatIls(row.gross)}</td>
                  <td className="p-3 font-semibold">{formatIls(row.pension)}</td>
                </tr>
              ))}
              {!loading && report && report.rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-white/50">
                    {tWorkers('pensionEmpty')}
                  </td>
                </tr>
              ) : null}
            </tbody>
            {report && report.rows.length > 0 ? (
              <tfoot className="border-t-2 border-white/20 font-bold">
                <tr>
                  <td className="p-3" colSpan={3}>{tWorkers('pensionTotal')}</td>
                  <td className="p-3">{formatIls(report.total)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>

        <p className="mt-4 text-xs text-white/50">{tWorkers('pensionNote')}</p>
      </div>
    </main>
  )
}
