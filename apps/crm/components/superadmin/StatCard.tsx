/**
 * Stat Card Component
 */

'use client'

import { TrendingUp, TrendingDown, Building2, Users, CreditCard, DollarSign } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  iconName: string
  trend?: string
  trendUp?: boolean
}

export function StatCard({ title, value, iconName, trend, trendUp }: StatCardProps) {
  // Render icon based on name
  const getIcon = () => {
    switch (iconName) {
      case 'building':
        return <Building2 className="h-6 w-6 text-blue-600" />
      case 'users':
        return <Users className="h-6 w-6 text-blue-600" />
      case 'card':
        return <CreditCard className="h-6 w-6 text-blue-600" />
      case 'dollar':
        return <DollarSign className="h-6 w-6 text-blue-600" />
      default:
        return <Building2 className="h-6 w-6 text-blue-600" />
    }
  }
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              {trendUp ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              <span className={`text-sm font-medium ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
                {trend}
              </span>
              <span className="text-sm text-gray-500">vs last month</span>
            </div>
          )}
        </div>
        <div className="p-3 bg-blue-50 rounded-lg">
          {getIcon()}
        </div>
      </div>
    </div>
  )
}

