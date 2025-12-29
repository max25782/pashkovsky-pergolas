/**
 * Recent Activity Component
 */

'use client'

import { Clock, Building2, CreditCard, UserPlus } from 'lucide-react'

export function RecentActivity() {
  // Mock data - replace with real data from API
  const activities = [
    {
      id: 1,
      type: 'subscription',
      icon: CreditCard,
      title: 'Pashkovsky Group upgraded to Pro',
      time: '2 hours ago',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      id: 2,
      type: 'company',
      icon: Building2,
      title: 'New company registered: ABC Construction',
      time: '5 hours ago',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      id: 3,
      type: 'user',
      icon: UserPlus,
      title: '12 new users registered today',
      time: '1 day ago',
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      id: 4,
      type: 'subscription',
      icon: CreditCard,
      title: 'XYZ Ltd trial ending in 3 days',
      time: '1 day ago',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    },
  ]

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
      
      <div className="space-y-4">
        {activities.map((activity) => {
          const Icon = activity.icon
          
          return (
            <div key={activity.id} className="flex items-start gap-3">
              <div className={`p-2 ${activity.bgColor} rounded-lg`}>
                <Icon className={`h-4 w-4 ${activity.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Clock className="h-3 w-3 text-gray-400" />
                  <span className="text-xs text-gray-500">{activity.time}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      
      <button className="w-full mt-4 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
        View All Activity
      </button>
    </div>
  )
}

