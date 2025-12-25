'use client'

import {
  BarChart,
  Bar,
  LineChart,
  Line,
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
import { formatCurrencyILS } from '@/lib/workers/calculations'
import type { MonthlyReport } from '@/types/workers'

interface MonthlyReportChartsProps {
  report: MonthlyReport
}

const COLORS = {
  revenue: '#3b82f6', // blue
  laborCost: '#f97316', // orange
  profit: '#10b981', // green
  profitNegative: '#ef4444', // red
}

export function MonthlyReportCharts({ report }: MonthlyReportChartsProps) {
  // Prepare data for charts
  const chartData = report.projects.map((project) => ({
    name: project.customerName.length > 15 
      ? project.customerName.substring(0, 15) + '...' 
      : project.customerName,
    fullName: project.customerName,
    revenue: project.revenue,
    laborCost: project.laborCost,
    profit: project.profit,
  }))

  // Summary data for pie chart
  const summaryData = [
    { name: 'רווח', value: Math.max(0, report.totalProfit), color: COLORS.profit },
    { name: 'עלות עובדים', value: report.totalLaborCost, color: COLORS.laborCost },
  ]

  // Format currency for tooltip
  const formatTooltipValue = (value: number) => formatCurrencyILS(value)

  return (
    <div className="space-y-8">
      {/* Revenue vs Labor Cost Bar Chart */}
      <div className="bg-gray-800 rounded-lg border border-white/10 p-6">
        <h3 className="text-xl font-bold mb-4 text-right">הכנסות מול עלות עובדים</h3>
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
            <Bar dataKey="revenue" fill={COLORS.revenue} name="הכנסות" />
            <Bar dataKey="laborCost" fill={COLORS.laborCost} name="עלות עובדים" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Profit Chart */}
      <div className="bg-gray-800 rounded-lg border border-white/10 p-6">
        <h3 className="text-xl font-bold mb-4 text-right">רווח לפי פרויקט</h3>
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
            <Bar 
              dataKey="profit" 
              name="רווח"
            >
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
      {report.totalRevenue > 0 && (
        <div className="bg-gray-800 rounded-lg border border-white/10 p-6">
          <h3 className="text-xl font-bold mb-4 text-right">חלוקת הכנסות</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={summaryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(1)}%`}
                  outerRadius={100}
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
            <div className="flex flex-col justify-center space-y-4">
              <div className="bg-blue-900/30 border border-blue-500/20 rounded-lg p-4">
                <div className="text-white/60 text-sm mb-1">סה״כ הכנסות</div>
                <div className="text-2xl font-bold text-blue-400">
                  {formatCurrencyILS(report.totalRevenue)}
                </div>
              </div>
              <div className="bg-orange-900/30 border border-orange-500/20 rounded-lg p-4">
                <div className="text-white/60 text-sm mb-1">סה״כ עלות עובדים</div>
                <div className="text-2xl font-bold text-orange-400">
                  {formatCurrencyILS(report.totalLaborCost)}
                </div>
                <div className="text-sm text-white/60 mt-1">
                  {((report.totalLaborCost / report.totalRevenue) * 100).toFixed(1)}% מההכנסות
                </div>
              </div>
              <div className={`border rounded-lg p-4 ${
                report.totalProfit >= 0
                  ? 'bg-green-900/30 border-green-500/20'
                  : 'bg-red-900/30 border-red-500/20'
              }`}>
                <div className="text-white/60 text-sm mb-1">סה״כ רווח נקי</div>
                <div className={`text-2xl font-bold ${
                  report.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {formatCurrencyILS(report.totalProfit)}
                </div>
                <div className={`text-sm mt-1 ${
                  report.totalProfit >= 0 ? 'text-green-300/80' : 'text-red-300/80'
                }`}>
                  {((report.totalProfit / report.totalRevenue) * 100).toFixed(1)}% שולי רווח
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revenue Trend Line Chart (if multiple months) */}
      {chartData.length > 1 && (
        <div className="bg-gray-800 rounded-lg border border-white/10 p-6">
          <h3 className="text-xl font-bold mb-4 text-right">מגמת הכנסות ורווח</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
              <XAxis 
                dataKey="name" 
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
                dataKey="revenue" 
                stroke={COLORS.revenue} 
                strokeWidth={2}
                name="הכנסות"
              />
              <Line 
                type="monotone" 
                dataKey="profit" 
                stroke={COLORS.profit} 
                strokeWidth={2}
                name="רווח"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

