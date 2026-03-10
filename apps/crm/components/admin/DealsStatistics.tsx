"use client"
import { useState, useMemo, useEffect } from 'react'
import type { Deal } from './deal-types'
import { formatCurrency } from './deal-utils'
import { MonthlyDealsModal } from './MonthlyDealsModal'
import { DealsCharts } from './DealsCharts'
import { MonthlyStatsChart } from './MonthlyStatsChart'
import { useTranslations } from 'next-intl'
import { LanguageSwitcher } from './LanguageSwitcher'
import { authFetch } from '@/lib/api/auth-fetch'

interface DealsStatisticsProps {
  deals: Deal[]
  onDealClick?: (deal: Deal) => void
}

type StatisticType = 'all' | 'money' // 'all' - все сделки, 'money' - только завершенные

interface MonthlyStats {
  month: string
  monthLabel: string
  revenue: number
  expenses: number
  profit: number
  dealCount: number
}

export function DealsStatistics({ deals, onDealClick }: DealsStatisticsProps) {
  const t = useTranslations('statistics')
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [selectedMonthLabel, setSelectedMonthLabel] = useState<string>('')
  const [statisticType, setStatisticType] = useState<StatisticType>('money')
  const [payments, setPayments] = useState<Array<{ deal_id: string; amount: number; paid_at: string }>>([])

  useEffect(() => {
    let cancelled = false
    authFetch('/admin-api/deals/payments-summary')
      .then((res) => (res.ok ? res.json() : { payments: [] }))
      .then((data) => {
        if (!cancelled) setPayments(data.payments ?? [])
      })
      .catch(() => { if (!cancelled) setPayments([]) })
    return () => { cancelled = true }
  }, [])

  const paymentsByDeal = useMemo(() => {
    const map = new Map<string, Array<{ amount: number; paid_at: string }>>()
    payments.forEach((p) => {
      const list = map.get(p.deal_id) ?? []
      list.push({ amount: Number(p.amount), paid_at: p.paid_at })
      map.set(p.deal_id, list)
    })
    return map
  }, [payments])

  // Filter deals based on statistic type
  const validDeals = useMemo(() => {
    let filtered = deals.filter(deal => deal && deal.id)
    
    if (statisticType === 'money') {
      filtered = filtered.filter(deal => {
        const isContractor = deal.customer_type === 'contractor'
        if (isContractor) return true
        return deal.stage === 'done' && deal.installation_date != null
      })
    }
    
    return filtered
  }, [deals, statisticType])
  
  const monthlyStats = useMemo(() => {
    const statsMap = new Map<string, MonthlyStats>()
    
    const addToMonth = (monthKey: string, revenue: number, expenses: number, dealCount: number) => {
      const [y, m] = monthKey.split('-').map(Number)
      const localDate = new Date(y, m - 1, 1)
      const monthLabel = localDate.toLocaleDateString('he-IL', { year: 'numeric', month: 'long' })
      const existing = statsMap.get(monthKey) || {
        month: monthKey,
        monthLabel,
        revenue: 0,
        expenses: 0,
        profit: 0,
        dealCount: 0
      }
      existing.revenue += revenue
      existing.expenses += expenses
      existing.profit = existing.revenue - existing.expenses
      existing.dealCount += dealCount
      statsMap.set(monthKey, existing)
    }

    validDeals.forEach(deal => {
      const isContractor = deal.customer_type === 'contractor'
      
      if (statisticType === 'money' && isContractor) {
        const dealPayments = paymentsByDeal.get(deal.id) ?? []
        const dealMonths = new Set<string>()
        dealPayments.forEach((p) => {
          const date = new Date(p.paid_at)
          if (isNaN(date.getTime())) return
          const year = date.getUTCFullYear()
          const month = date.getUTCMonth() + 1
          const monthKey = `${year}-${String(month).padStart(2, '0')}`
          addToMonth(monthKey, p.amount, 0, 0)
          dealMonths.add(monthKey)
        })
        dealMonths.forEach((monthKey) => addToMonth(monthKey, 0, 0, 1))
        return
      }

      const dateToUse: string | null | undefined = statisticType === 'money'
        ? deal.installation_date
        : (deal.installation_date || deal.order_date || deal.created_at)
      
      if (!dateToUse) return

      const date = new Date(dateToUse)
      if (isNaN(date.getTime())) return
      
      const year = date.getUTCFullYear()
      const month = date.getUTCMonth() + 1
      const monthKey = `${year}-${String(month).padStart(2, '0')}`

      addToMonth(monthKey, deal.price || 0, deal.my_cost || 0, 1)
    })

    return Array.from(statsMap.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .reverse()
  }, [validDeals, paymentsByDeal, statisticType])

  const totals = useMemo(() => {
    return monthlyStats.reduce(
      (acc, stat) => ({
        revenue: acc.revenue + stat.revenue,
        expenses: acc.expenses + stat.expenses,
        profit: acc.profit + stat.profit,
        dealCount: acc.dealCount + stat.dealCount
      }),
      { revenue: 0, expenses: 0, profit: 0, dealCount: 0 }
    )
  }, [monthlyStats])

  return (
    <div className="bg-white/5 rounded-lg border border-white/10 p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-white">
          {t('title')}
        </h2>
        
        <div className="flex items-center gap-4 flex-wrap">
          {/* Language Switcher */}
          <LanguageSwitcher />
          
          {/* Filter Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/70">{t('statisticsType')}</span>
            <div className="flex gap-2 bg-white/10 rounded-lg p-1">
              <button
                onClick={() => setStatisticType('money')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  statisticType === 'money'
                    ? 'bg-green-600 text-white'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {t('withMoney')}
              </button>
              <button
                onClick={() => setStatisticType('all')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  statisticType === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {t('all')}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mb-4 text-sm text-white/60">
        {statisticType === 'money' ? t('noteWithMoney') : t('noteAll')}
      </div>

      {monthlyStats.length === 0 ? (
        <div className="text-center text-white/60 py-8">
          {t('noData')}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto mb-6">
            <table className="min-w-full text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="p-3 text-left text-xs font-semibold text-white/70 uppercase">{t('month')}</th>
                  <th className="p-3 text-right text-xs font-semibold text-white/70 uppercase">{t('dealCount')}</th>
                  <th className="p-3 text-right text-xs font-semibold text-white/70 uppercase">{t('revenue')}</th>
                  <th className="p-3 text-right text-xs font-semibold text-white/70 uppercase">{t('expenses')}</th>
                  <th className="p-3 text-right text-xs font-semibold text-white/70 uppercase">{t('profit')}</th>
                </tr>
              </thead>
              <tbody>
                {monthlyStats.map((stat) => (
                  <tr 
                    key={stat.month} 
                    className="border-t border-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedMonth(stat.month)
                      setSelectedMonthLabel(stat.monthLabel)
                    }}
                    title={t('clickToSee')}
                  >
                    <td className="p-3 font-medium text-white">{stat.monthLabel}</td>
                    <td className="p-3 text-right text-white/70">{stat.dealCount}</td>
                    <td className="p-3 text-right font-semibold text-green-400">
                      {formatCurrency(stat.revenue)}
                    </td>
                    <td className="p-3 text-right font-semibold text-red-400">
                      {formatCurrency(stat.expenses)}
                    </td>
                    <td className={`p-3 text-right font-bold ${
                      stat.profit >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {formatCurrency(stat.profit)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-white/20 bg-white/5 font-bold">
                  <td className="p-3 font-semibold text-white">{t('total')}</td>
                  <td className="p-3 text-right text-white">{totals.dealCount}</td>
                  <td className="p-3 text-right text-green-400">
                    {formatCurrency(totals.revenue)}
                  </td>
                  <td className="p-3 text-right text-red-400">
                    {formatCurrency(totals.expenses)}
                  </td>
                  <td className={`p-3 text-right ${
                    totals.profit >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {formatCurrency(totals.profit)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4">
              <div className="text-sm text-green-200 mb-1">{t('totalRevenue')}</div>
              <div className="text-2xl font-bold text-green-400">
                {formatCurrency(totals.revenue)}
              </div>
            </div>
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
              <div className="text-sm text-red-200 mb-1">{t('totalExpenses')}</div>
              <div className="text-2xl font-bold text-red-400">
                {formatCurrency(totals.expenses)}
              </div>
            </div>
            <div className={`${
              totals.profit >= 0 ? 'bg-green-500/20 border-green-500/50' : 'bg-red-500/20 border-red-500/50'
            } border rounded-lg p-4`}>
              <div className={`text-sm mb-1 ${
                totals.profit >= 0 ? 'text-green-200' : 'text-red-200'
              }`}>
                {t('totalProfit')}
              </div>
              <div className={`text-2xl font-bold ${
                totals.profit >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {formatCurrency(totals.profit)}
              </div>
            </div>
            <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4">
              <div className="text-sm text-blue-200 mb-1">{t('totalDeals')}</div>
              <div className="text-2xl font-bold text-blue-400">
                {totals.dealCount}
              </div>
            </div>
          </div>

          {/* Monthly Stats Charts */}
          <MonthlyStatsChart monthlyStats={monthlyStats} />

          {/* Charts */}
          <DealsCharts deals={validDeals} />
        </>
      )}

      {/* Monthly Deals Modal */}
      {selectedMonth && (
        <MonthlyDealsModal
          month={selectedMonth}
          monthLabel={selectedMonthLabel}
          deals={deals}
          statisticType={statisticType}
          onClose={() => {
            setSelectedMonth(null)
            setSelectedMonthLabel('')
          }}
          onDealClick={(deal) => {
            setSelectedMonth(null)
            setSelectedMonthLabel('')
            onDealClick?.(deal)
          }}
        />
      )}
    </div>
  )
}

