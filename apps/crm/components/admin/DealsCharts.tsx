'use client'

import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { Deal } from './deal-types'

interface DealsChartsLabels {
  revenueVsExpensesTop10: string
  profitByDeal: string
  revenueDistribution: string
  revenue: string
  expenses: string
  profit: string
  totalRevenue: string
  totalExpenses: string
  totalProfit: string
  noName: string
}

interface DealsChartsProps {
  deals: Deal[]
  labels: DealsChartsLabels
}

const COLORS = {
  revenue: '#3b82f6', // blue
  expenses: '#f97316', // orange
  profit: '#10b981', // green
  profitNegative: '#ef4444', // red
}

export function DealsCharts({ deals, labels }: DealsChartsProps) {
  // Calculate totals
  const totals = deals.reduce(
    (acc, deal) => {
      const revenue = deal.price || 0
      const expenses = deal.my_cost || 0
      const profit = revenue - expenses

      return {
        revenue: acc.revenue + revenue,
        expenses: acc.expenses + expenses,
        profit: acc.profit + profit,
        dealCount: acc.dealCount + 1,
      }
    },
    { revenue: 0, expenses: 0, profit: 0, dealCount: 0 }
  )

  // Prepare data for charts
  const chartData = deals
    .filter(deal => (deal.price || 0) > 0 || (deal.my_cost || 0) > 0)
    .map((deal) => {
      const customerName = deal.customer_name || labels.noName
      return {
        name: customerName.length > 15
          ? customerName.substring(0, 15) + '...'
          : customerName,
        fullName: customerName,
        revenue: deal.price || 0,
        expenses: deal.my_cost || 0,
        profit: (deal.price || 0) - (deal.my_cost || 0),
      }
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10) // Top 10 deals

  // Summary data for pie chart
  const summaryData = [
    { name: labels.profit, value: Math.max(0, totals.profit), color: COLORS.profit },
    { name: labels.expenses, value: totals.expenses, color: COLORS.expenses },
  ]

  // Format currency for tooltip
  const formatTooltipValue = (value: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0,
    }).format(value)
  }

  if (chartData.length === 0) {
    return null
  }

  return (
    <div className="space-y-6 mt-6">
      {/* Revenue vs Expenses Bar Chart */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-6">
        <h3 className="text-lg font-bold mb-4 text-right">{labels.revenueVsExpensesTop10}</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
            <XAxis type="number" tick={{ fill: '#ffffff80' }} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: '#ffffff80' }}
              width={120}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #ffffff20',
                borderRadius: '8px',
                color: '#ffffff'
              }}
              formatter={formatTooltipValue}
            />
            <Legend />
            <Bar dataKey="revenue" fill={COLORS.revenue} name={labels.revenue} />
            <Bar dataKey="expenses" fill={COLORS.expenses} name={labels.expenses} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Profit Chart */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-6">
        <h3 className="text-lg font-bold mb-4 text-right">{labels.profitByDeal}</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
            <XAxis type="number" tick={{ fill: '#ffffff80' }} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: '#ffffff80' }}
              width={120}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #ffffff20',
                borderRadius: '8px',
                color: '#ffffff'
              }}
              formatter={formatTooltipValue}
            />
            <Bar dataKey="profit" name={labels.profit}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.profit >= 0 ? COLORS.profit : COLORS.profitNegative}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Pie Chart */}
      {totals.revenue > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          <h3 className="text-lg font-bold mb-4 text-right">{labels.revenueDistribution}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={summaryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {summaryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #ffffff20',
                    borderRadius: '8px',
                    color: '#ffffff'
                  }}
                  formatter={formatTooltipValue}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>

            {/* Summary Stats */}
            <div className="flex flex-col justify-center space-y-3">
              <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-3">
                <div className="text-sm text-green-200 mb-1">{labels.totalRevenue}</div>
                <div className="text-xl font-bold text-green-400">
                  {formatTooltipValue(totals.revenue)}
                </div>
              </div>
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3">
                <div className="text-sm text-red-200 mb-1">{labels.totalExpenses}</div>
                <div className="text-xl font-bold text-red-400">
                  {formatTooltipValue(totals.expenses)}
                </div>
              </div>
              <div className={`border rounded-lg p-3 ${
                totals.profit >= 0
                  ? 'bg-green-500/20 border-green-500/50'
                  : 'bg-red-500/20 border-red-500/50'
              }`}>
                <div className={`text-sm mb-1 ${
                  totals.profit >= 0 ? 'text-green-200' : 'text-red-200'
                }`}>
                  {labels.totalProfit}
                </div>
                <div className={`text-xl font-bold ${
                  totals.profit >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {formatTooltipValue(totals.profit)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
