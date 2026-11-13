"use client"
import { useState, useMemo, useEffect } from 'react'
import type { Deal } from './deal-types'
import {
  aggregateMonthlyDealStats,
  buildPaymentsByDeal,
  formatCurrency,
  isRevenueDeal,
  type DealPayment,
  type StatisticType,
} from './deal-utils'
import { MonthlyDealsModal } from './MonthlyDealsModal'
import { DealsCharts } from './DealsCharts'
import { MonthlyStatsChart } from './MonthlyStatsChart'
import { useTranslations } from 'next-intl'
import { LanguageSwitcher } from './LanguageSwitcher'
import { authFetch } from '@/lib/api/auth-fetch'
import { useLanguage } from '@/lib/language-context'
import { useDealFinanceContext } from './hooks/useDealFinanceContext'
import { useDealStages } from './hooks/useDealStages'
import { aggregateMonthlyNetMetrics, sumNetMetrics } from '@/lib/deals/deal-profit'

interface DealsStatisticsProps {
  deals: Deal[]
  onDealClick?: (deal: Deal) => void
}

const LOCALE_MAP: Record<string, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  he: 'he-IL',
}

export function DealsStatistics({ deals, onDealClick }: DealsStatisticsProps) {
  const t = useTranslations('statistics')
  const { language } = useLanguage()
  const dateLocale = LOCALE_MAP[language] ?? 'en-US'
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [selectedMonthLabel, setSelectedMonthLabel] = useState<string>('')
  const [statisticType, setStatisticType] = useState<StatisticType>('money')
  const [payments, setPayments] = useState<DealPayment[]>([])

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

  const paymentsByDeal = useMemo(() => buildPaymentsByDeal(payments), [payments])

  // VAT payable and net profit need the company VAT rate and worker cost per deal.
  const financeContext = useDealFinanceContext()
  const { roleOf } = useDealStages()
  const netByMonth = useMemo(
    () =>
      financeContext.isReady
        ? aggregateMonthlyNetMetrics(deals, statisticType, paymentsByDeal, financeContext, roleOf)
        : null,
    [deals, statisticType, paymentsByDeal, financeContext, roleOf],
  )
  const netTotals = useMemo(() => (netByMonth ? sumNetMetrics(netByMonth.values()) : null), [netByMonth])

  const validDeals = useMemo(
    () => deals.filter((deal) => isRevenueDeal(deal, statisticType, roleOf)),
    [deals, statisticType, roleOf],
  )

  const { monthlyStats, datelessCount } = useMemo(
    () => aggregateMonthlyDealStats(deals, statisticType, paymentsByDeal, dateLocale, roleOf),
    [deals, statisticType, paymentsByDeal, dateLocale, roleOf],
  )

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

      {statisticType === 'all' && datelessCount > 0 && (
        <div className="mb-4 text-sm text-amber-300">
          {t('datelessCount', { count: datelessCount })}
        </div>
      )}

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
                  {netByMonth && (
                    <>
                      <th className="p-3 text-right text-xs font-semibold text-white/70 uppercase">{t('vatPayable')}</th>
                      <th className="p-3 text-right text-xs font-semibold text-white/70 uppercase">{t('netProfit')}</th>
                    </>
                  )}
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
                    {netByMonth && (
                      <>
                        <td className="p-3 text-right font-semibold text-amber-300">
                          {formatCurrency(netByMonth.get(stat.month)?.vatPayable ?? 0)}
                        </td>
                        <td className={`p-3 text-right font-bold ${
                          (netByMonth.get(stat.month)?.netProfit ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {formatCurrency(netByMonth.get(stat.month)?.netProfit ?? 0)}
                        </td>
                      </>
                    )}
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
                  {netTotals && (
                    <>
                      <td className="p-3 text-right text-amber-300">{formatCurrency(netTotals.vatPayable)}</td>
                      <td className={`p-3 text-right ${netTotals.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(netTotals.netProfit)}
                      </td>
                    </>
                  )}
                </tr>
              </tbody>
            </table>
          </div>

          {netTotals && (
            <div className="mb-2 text-xs text-white/50">{t('vatRefundNote')}</div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4 mt-6">
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
            {netTotals && (
              <>
                <div className="bg-amber-500/20 border border-amber-500/50 rounded-lg p-4">
                  <div className="text-sm text-amber-200 mb-1">{t('totalVatPayable')}</div>
                  <div className="text-2xl font-bold text-amber-300">{formatCurrency(netTotals.vatPayable)}</div>
                </div>
                <div className={`${
                  netTotals.netProfit >= 0 ? 'bg-green-500/20 border-green-500/50' : 'bg-red-500/20 border-red-500/50'
                } border rounded-lg p-4`}>
                  <div className="text-sm text-white/70 mb-1">{t('totalNetProfit')}</div>
                  <div className={`text-2xl font-bold ${netTotals.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(netTotals.netProfit)}
                  </div>
                </div>
              </>
            )}
            <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4">
              <div className="text-sm text-blue-200 mb-1">{t('totalDeals')}</div>
              <div className="text-2xl font-bold text-blue-400">
                {totals.dealCount}
              </div>
            </div>
          </div>

          {/* Monthly Stats Charts */}
          <MonthlyStatsChart
            monthlyStats={monthlyStats}
            labels={{
              revenueVsExpenses: t('chartRevenueVsExpenses'),
              profitTrend: t('chartProfitTrend'),
              dealCount: t('chartDealCount'),
              revenue: t('revenue'),
              expenses: t('expenses'),
              profit: t('profit'),
              dealCountLabel: t('chartDealCountLabel'),
            }}
          />

          {/* Charts */}
          <DealsCharts
            deals={validDeals}
            statisticType={statisticType}
            financeContext={financeContext.isReady ? financeContext : undefined}
            labels={{
              revenueVsExpensesTop10: t('chartRevenueVsExpensesTop10'),
              profitByDeal: financeContext.isReady ? t('chartNetProfitByDeal') : t('chartProfitByDeal'),
              revenueDistribution: t('chartRevenueDistribution'),
              revenue: t('revenue'),
              expenses: t('expenses'),
              profit: t('profit'),
              totalRevenue: t('chartTotalRevenue'),
              totalExpenses: t('chartTotalExpenses'),
              totalProfit: t('chartTotalProfit'),
              noName: t('noName'),
            }}
          />
        </>
      )}

      {/* Monthly Deals Modal */}
      {selectedMonth && (
        <MonthlyDealsModal
          month={selectedMonth}
          monthLabel={selectedMonthLabel}
          deals={deals}
          statisticType={statisticType}
          paymentsByDeal={paymentsByDeal}
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

