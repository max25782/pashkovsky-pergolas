'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatCurrencyILS } from '@/lib/workers/calculations'
import type { MonthlyReport } from '@/types/workers'
import type { Locale } from '@/lib/locales'
import { useCRMTranslations } from '@/components/admin/useCRMTranslations'
import { MonthlyReportCharts } from '@/components/admin/MonthlyReportCharts'

export default function MonthlyReportPage() {
  const t = useCRMTranslations()
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [input, setInput] = useState('')
  
  // Default to current month
  const currentDate = new Date()
  const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
  
  const [month, setMonth] = useState(currentMonth)
  const [report, setReport] = useState<MonthlyReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const storedToken = localStorage.getItem('admin_token')
    if (storedToken) setToken(storedToken)
  }, [])

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

  useEffect(() => {
    fetchReport()
  }, [month])

  const fetchReport = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/reports/monthly?month=${month}`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch report`)
      }
      
      const data = await response.json()
      
      if (!data.report) {
        throw new Error('Invalid response format')
      }
      
      setReport(data.report)
    } catch (err: any) {
      console.error('[Monthly Report] Fetch error:', err)
      setError(err.message || 'Failed to load report')
      setReport(null)
    } finally {
      setLoading(false)
    }
  }

  const formatMonthLabel = (monthStr: string) => {
    const [year, monthNum] = monthStr.split('-')
    const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1)
    return date.toLocaleDateString('he-IL', { year: 'numeric', month: 'long' })
  }

  if (!token) {
    return (
      <main className="container py-16 text-white">
        <h1 className="text-2xl font-bold mb-4">Admin • {t.nav.reports}</h1>
        <div className="max-w-md bg-white/5 border border-white/10 rounded-xl p-6">
          <label className="block text-sm mb-2">{t.auth.enterAdminToken}</label>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
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
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Admin • {t.nav.reports}</h1>
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/app/admin/deals"
            className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 font-semibold"
          >
            {t.nav.deals}
          </Link>
          <Link
            href="/app/admin/deals"
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
          <button onClick={logout} className="px-3 py-2 rounded bg-white/10 hover:bg-white/20">
            {t.common.logout}
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-3xl font-bold mb-2">דוח חודשי</h2>
          <p className="text-white/60">סיכום הכנסות, עלויות עובדים ורווח</p>
        </div>

        {/* Month Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-white/80 mb-2">
            בחר חודש
          </label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-4 py-2 rounded-lg bg-gray-800 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {loading ? (
          <div className="text-center py-12 text-white/60">טוען דוח...</div>
        ) : error ? (
          <div className="text-center py-12 text-red-400">{error}</div>
        ) : report ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Total Revenue */}
              <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 rounded-lg p-6 border border-blue-500/20">
                <div className="text-white/60 text-sm mb-2">סה״כ הכנסות</div>
                <div className="text-3xl font-bold text-blue-400">
                  {formatCurrencyILS(report.totalRevenue)}
                </div>
              </div>

              {/* Total Labor Cost */}
              <div className="bg-gradient-to-br from-orange-900/30 to-orange-800/20 rounded-lg p-6 border border-orange-500/20">
                <div className="text-white/60 text-sm mb-2">סה״כ עלות עובדים</div>
                <div className="text-3xl font-bold text-orange-400">
                  {formatCurrencyILS(report.totalLaborCost)}
                </div>
                {report.totalRevenue > 0 && (
                  <div className="text-sm text-white/60 mt-2">
                    {(report.totalLaborCost / report.totalRevenue * 100).toFixed(1)}% מההכנסות
                  </div>
                )}
              </div>

              {/* Total Profit */}
              <div className={`bg-gradient-to-br rounded-lg p-6 border ${
                report.totalProfit >= 0
                  ? 'from-green-900/30 to-green-800/20 border-green-500/20'
                  : 'from-red-900/30 to-red-800/20 border-red-500/20'
              }`}>
                <div className="text-white/60 text-sm mb-2">סה״כ רווח נקי</div>
                <div className={`text-3xl font-bold ${
                  report.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {formatCurrencyILS(report.totalProfit)}
                </div>
                {report.totalRevenue > 0 && (
                  <div className={`text-sm mt-2 ${
                    report.totalProfit >= 0 ? 'text-green-300/80' : 'text-red-300/80'
                  }`}>
                    {((report.totalProfit / report.totalRevenue) * 100).toFixed(1)}% שולי רווח
                  </div>
                )}
              </div>
            </div>

            {/* Charts */}
            <div className="mb-8">
              <MonthlyReportCharts report={report} />
            </div>

            {/* Projects Table */}
            <div className="bg-gray-800 rounded-lg border border-white/10 overflow-hidden">
              <div className="p-4 border-b border-white/10">
                <h2 className="text-xl font-bold">
                  פרויקטים - {formatMonthLabel(month)}
                </h2>
              </div>

              {report.projects.length === 0 ? (
                <div className="p-8 text-center text-white/60">
                  אין פרויקטים בחודש זה
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-900/50">
                      <tr>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-white/80">
                          לקוח / פרויקט
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-white/80">
                          הכנסות
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-white/80">
                          עלות עובדים
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-white/80">
                          רווח נקי
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-white/80">
                          שולי רווח
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.projects.map((project) => {
                        const profitMargin = project.revenue > 0
                          ? (project.profit / project.revenue) * 100
                          : 0

                        return (
                          <tr
                            key={project.projectId}
                            className="border-b border-white/5 hover:bg-gray-700/30 transition"
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium">{project.customerName}</div>
                              <div className="text-sm text-white/60">{project.projectName}</div>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold">
                              {formatCurrencyILS(project.revenue)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {formatCurrencyILS(project.laborCost)}
                            </td>
                            <td className={`px-4 py-3 text-right font-semibold ${
                              project.profit >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {formatCurrencyILS(project.profit)}
                            </td>
                            <td className={`px-4 py-3 text-right text-sm ${
                              profitMargin >= 0 ? 'text-green-300/80' : 'text-red-300/80'
                            }`}>
                              {profitMargin.toFixed(1)}%
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </main>
  )
}


