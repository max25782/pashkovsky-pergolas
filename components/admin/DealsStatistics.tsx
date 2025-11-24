"use client"
import { useState, useMemo } from 'react'
import type { Deal } from './deal-types'
import { formatCurrency } from './deal-utils'
import { MonthlyDealsModal } from './MonthlyDealsModal'

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
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [selectedMonthLabel, setSelectedMonthLabel] = useState<string>('')
  const [statisticType, setStatisticType] = useState<StatisticType>('money')
  
  const monthlyStats = useMemo(() => {
    const statsMap = new Map<string, MonthlyStats>()

    // Фильтруем сделки в зависимости от выбранного типа статистики
    let validDeals = deals.filter(deal => deal && deal.id)
    
    // Если выбран тип 'money', показываем только завершенные сделки (done)
    if (statisticType === 'money') {
      validDeals = validDeals.filter(deal => {
        return deal.stage === 'done'
      })
    }
    
    validDeals.forEach(deal => {
      // Используем дату установки (installation_date) в приоритете
      // Если даты установки нет, используем дату заказа (order_date)
      // Если и её нет, используем дату создания (created_at)
      let dateToUse: string | null | undefined = deal.installation_date || deal.order_date || deal.created_at
      
      if (!dateToUse) return

      // Парсим дату и используем UTC для избежания проблем с часовыми поясами
      const date = new Date(dateToUse)
      // Проверяем, что дата валидна
      if (isNaN(date.getTime())) return
      
      // Используем UTC методы для правильного определения месяца независимо от часового пояса
      const year = date.getUTCFullYear()
      const month = date.getUTCMonth() + 1 // getUTCMonth() возвращает 0-11
      const monthKey = `${year}-${String(month).padStart(2, '0')}`
      
      // Создаем дату в локальном времени для отображения месяца на иврите
      const localDate = new Date(year, month - 1, 1) // month - 1 потому что конструктор использует 0-11
      const monthLabel = localDate.toLocaleDateString('he-IL', { year: 'numeric', month: 'long' })

      const existing = statsMap.get(monthKey) || {
        month: monthKey,
        monthLabel,
        revenue: 0,
        expenses: 0,
        profit: 0,
        dealCount: 0
      }

      existing.revenue += deal.price || 0
      existing.expenses += deal.my_cost || 0
      existing.profit = existing.revenue - existing.expenses
      existing.dealCount += 1

      statsMap.set(monthKey, existing)
    })

    return Array.from(statsMap.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .reverse()
  }, [deals, statisticType])

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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">
          הכנסות והוצאות לפי חודש (Доходы и расходы по месяцам)
        </h2>
        
        {/* Filter Toggle */}
        <div className="flex items-center gap-4">
          <span className="text-sm text-white/70">סוג סטטיסטיקה (Тип статистики):</span>
          <div className="flex gap-2 bg-white/10 rounded-lg p-1">
            <button
              onClick={() => setStatisticType('money')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                statisticType === 'money'
                  ? 'bg-green-600 text-white'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              עם כסף (С деньгами)
            </button>
            <button
              onClick={() => setStatisticType('all')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                statisticType === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              הכל (Все)
            </button>
          </div>
        </div>
      </div>
      
      <div className="mb-4 text-sm text-white/60">
        {statisticType === 'money' ? (
          <>* Показываются только завершенные сделки (Готово / done) - те, которые уже принесли деньги. Статистика основана на дате установки (תאריך התקנה), при отсутствии - на дате заказа или создания</>
        ) : (
          <>* Показываются все сделки. Статистика основана на дате установки (תאריך התקנה), при отсутствии - на дате заказа или создания</>
        )}
      </div>

      {monthlyStats.length === 0 ? (
        <div className="text-center text-white/60 py-8">
          אין נתונים (Нет данных)
        </div>
      ) : (
        <>
          <div className="overflow-x-auto mb-6">
            <table className="min-w-full text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="p-3 text-left text-xs font-semibold text-white/70 uppercase">חודש (Месяц)</th>
                  <th className="p-3 text-right text-xs font-semibold text-white/70 uppercase">כמות עסקאות (Кол-во сделок)</th>
                  <th className="p-3 text-right text-xs font-semibold text-white/70 uppercase">הכנסות (Доходы)</th>
                  <th className="p-3 text-right text-xs font-semibold text-white/70 uppercase">הוצאות (Расходы)</th>
                  <th className="p-3 text-right text-xs font-semibold text-white/70 uppercase">רווח (Прибыль)</th>
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
                    title="לחץ כדי לראות עסקאות (Нажмите, чтобы увидеть сделки)"
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
                  <td className="p-3 font-semibold text-white">סה"כ (Итого)</td>
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
              <div className="text-sm text-green-200 mb-1">סה"כ הכנסות (Общий доход)</div>
              <div className="text-2xl font-bold text-green-400">
                {formatCurrency(totals.revenue)}
              </div>
            </div>
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
              <div className="text-sm text-red-200 mb-1">סה"כ הוצאות (Общие расходы)</div>
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
                סה"כ רווח (Общая прибыль)
              </div>
              <div className={`text-2xl font-bold ${
                totals.profit >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {formatCurrency(totals.profit)}
              </div>
            </div>
            <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4">
              <div className="text-sm text-blue-200 mb-1">סה"כ עסקאות (Всего сделок)</div>
              <div className="text-2xl font-bold text-blue-400">
                {totals.dealCount}
              </div>
            </div>
          </div>
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

