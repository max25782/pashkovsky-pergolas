"use client"
import { useMemo } from 'react'
import type { Deal } from './deal-types'
import { formatCurrency, formatDate } from './deal-utils'
import { getStages } from './deal-types'
import { useCRMTranslations } from './useCRMTranslations'
import { useTranslations } from 'next-intl'

interface MonthlyDealsModalProps {
  month: string
  monthLabel: string
  deals: Deal[]
  statisticType?: 'all' | 'money'
  onClose: () => void
  onDealClick?: (deal: Deal) => void
}

export function MonthlyDealsModal({
  month,
  monthLabel,
  deals,
  statisticType = 'all',
  onClose,
  onDealClick
}: MonthlyDealsModalProps) {
  const t = useTranslations('statistics')
  const tCRM = useCRMTranslations()
  const stages = getStages(tCRM.deals)

  const monthlyDeals = useMemo(() => {
    return deals.filter(deal => {
      if (!deal || !deal.id) return false

      // Mirror the exact same filter logic used in DealsStatistics validDeals
      if (statisticType === 'money') {
        const isContractor = deal.customer_type === 'contractor'
        if (!isContractor) {
          // Non-contractors: must be done AND have an installation_date
          if (deal.stage !== 'done' || deal.installation_date == null) return false
        }
        // Contractors: always included (their revenue comes from payments, not deal.price)
      }

      // Date bucketing — same logic as DealsStatistics monthlyStats
      const dateToUse: string | null | undefined = statisticType === 'money'
        ? deal.installation_date
        : (deal.installation_date || deal.order_date || deal.created_at)

      if (!dateToUse) return false

      const date = new Date(dateToUse)
      if (isNaN(date.getTime())) return false

      const year = date.getUTCFullYear()
      const dealMonth = date.getUTCMonth() + 1
      const dealMonthKey = `${year}-${String(dealMonth).padStart(2, '0')}`

      return dealMonthKey === month
    })
  }, [deals, month, statisticType])

  const totals = useMemo(() => {
    return monthlyDeals.reduce(
      (acc, deal) => ({
        revenue: acc.revenue + (deal.price || 0),
        expenses: acc.expenses + (deal.my_cost || 0),
        profit: acc.profit + ((deal.price || 0) - (deal.my_cost || 0)),
        dealCount: acc.dealCount + 1
      }),
      { revenue: 0, expenses: 0, profit: 0, dealCount: 0 }
    )
  }, [monthlyDeals])

  const getStageLabel = (stage: string | null | undefined) => {
    const stageObj = stages.find(s => s.id === stage)
    return stageObj?.label || stage || '—'
  }

  const getStageColor = (stage: string | null | undefined) => {
    const stageObj = stages.find(s => s.id === stage)
    return stageObj?.color || 'bg-gray-500'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-white/20 rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-2xl font-bold text-white">
            {t('modalTitle', { month: monthLabel })}
          </h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors text-2xl font-bold w-8 h-8 flex items-center justify-center rounded hover:bg-white/10"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Summary */}
        <div className="p-6 border-b border-white/10 bg-white/5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-sm text-white/60 mb-1">{t('dealCount')}</div>
              <div className="text-2xl font-bold text-blue-400">{totals.dealCount}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-white/60 mb-1">{t('revenue')}</div>
              <div className="text-2xl font-bold text-green-400">{formatCurrency(totals.revenue)}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-white/60 mb-1">{t('expenses')}</div>
              <div className="text-2xl font-bold text-red-400">{formatCurrency(totals.expenses)}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-white/60 mb-1">{t('profit')}</div>
              <div className={`text-2xl font-bold ${totals.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(totals.profit)}
              </div>
            </div>
          </div>
        </div>

        {/* Deals List */}
        <div className="flex-1 overflow-y-auto p-6">
          {monthlyDeals.length === 0 ? (
            <div className="text-center text-white/60 py-12">
              {t('noDealsThisMonth')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-white/5 sticky top-0">
                  <tr>
                    <th className="p-3 text-left text-xs font-semibold text-white/70 uppercase">{t('customer')}</th>
                    <th className="p-3 text-left text-xs font-semibold text-white/70 uppercase">{t('phone')}</th>
                    <th className="p-3 text-left text-xs font-semibold text-white/70 uppercase">{t('projectType')}</th>
                    <th className="p-3 text-left text-xs font-semibold text-white/70 uppercase">{t('stage')}</th>
                    <th className="p-3 text-right text-xs font-semibold text-white/70 uppercase">{t('installationDate')}</th>
                    <th className="p-3 text-right text-xs font-semibold text-white/70 uppercase">{t('price')}</th>
                    <th className="p-3 text-right text-xs font-semibold text-white/70 uppercase">{t('cost')}</th>
                    <th className="p-3 text-right text-xs font-semibold text-white/70 uppercase">{t('profit')}</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyDeals.map((deal) => {
                    const dealProfit = (deal.price || 0) - (deal.my_cost || 0)
                    const dealDate = deal.installation_date || deal.order_date || deal.created_at
                    
                    return (
                      <tr
                        key={deal.id}
                        className="border-t border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                        onClick={() => onDealClick?.(deal)}
                      >
                        <td className="p-3 font-medium text-white">
                          {deal.customer_name || '—'}
                        </td>
                        <td className="p-3 text-white/70">
                          {deal.customer_phone ? (
                            <a
                              href={`tel:${deal.customer_phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-white underline"
                            >
                              {deal.customer_phone}
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="p-3 text-white/70">
                          {deal.project_type || '—'}
                        </td>
                        <td className="p-3">
                          <span className={`inline-block px-2 py-1 rounded text-xs text-white ${getStageColor(deal.stage)}`}>
                            {getStageLabel(deal.stage)}
                          </span>
                        </td>
                        <td className="p-3 text-right text-white/70">
                          {dealDate ? formatDate(dealDate) : '—'}
                        </td>
                        <td className="p-3 text-right font-semibold text-green-400">
                          {formatCurrency(deal.price)}
                        </td>
                        <td className="p-3 text-right font-semibold text-red-400">
                          {formatCurrency(deal.my_cost)}
                        </td>
                        <td className={`p-3 text-right font-bold ${
                          dealProfit >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {formatCurrency(dealProfit)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  )
}

