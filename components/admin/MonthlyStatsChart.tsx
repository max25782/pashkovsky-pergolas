'use client'

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface MonthlyStats {
  month: string
  monthLabel: string
  revenue: number
  expenses: number
  profit: number
  dealCount: number
}

interface MonthlyStatsChartProps {
  monthlyStats: MonthlyStats[]
}

const COLORS = {
  revenue: '#3b82f6', // blue
  expenses: '#f97316', // orange
  profit: '#10b981', // green
}

export function MonthlyStatsChart({ monthlyStats }: MonthlyStatsChartProps) {
  if (monthlyStats.length === 0) {
    return null
  }

  // Sort by month
  const sortedStats = [...monthlyStats].sort((a, b) => a.month.localeCompare(b.month))

  // Format currency for tooltip
  const formatTooltipValue = (value: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0,
    }).format(value)
  }

  return (
    <div className="space-y-6 mt-6">
      {/* Revenue and Expenses by Month */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-6">
        <h3 className="text-lg font-bold mb-4 text-right">הכנסות והוצאות לפי חודש</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={sortedStats}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
            <XAxis 
              dataKey="monthLabel" 
              tick={{ fill: '#ffffff80' }}
              angle={-45}
              textAnchor="end"
              height={100}
            />
            <YAxis tick={{ fill: '#ffffff80' }} />
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
            <Bar dataKey="revenue" fill={COLORS.revenue} name="הכנסות" />
            <Bar dataKey="expenses" fill={COLORS.expenses} name="הוצאות" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Profit Trend */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-6">
        <h3 className="text-lg font-bold mb-4 text-right">מגמת רווח</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={sortedStats}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
            <XAxis 
              dataKey="monthLabel" 
              tick={{ fill: '#ffffff80' }}
              angle={-45}
              textAnchor="end"
              height={100}
            />
            <YAxis tick={{ fill: '#ffffff80' }} />
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
            <Line 
              type="monotone" 
              dataKey="profit" 
              stroke={COLORS.profit} 
              strokeWidth={2}
              name="רווח"
            />
            <Line 
              type="monotone" 
              dataKey="revenue" 
              stroke={COLORS.revenue} 
              strokeWidth={2}
              strokeDasharray="5 5"
              name="הכנסות"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Deal Count by Month */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-6">
        <h3 className="text-lg font-bold mb-4 text-right">מספר עסקאות לפי חודש</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={sortedStats}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
            <XAxis 
              dataKey="monthLabel" 
              tick={{ fill: '#ffffff80' }}
              angle={-45}
              textAnchor="end"
              height={100}
            />
            <YAxis tick={{ fill: '#ffffff80' }} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1f2937', 
                border: '1px solid #ffffff20',
                borderRadius: '8px',
                color: '#ffffff'
              }}
            />
            <Bar dataKey="dealCount" fill="#8b5cf6" name="מספר עסקאות" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}


