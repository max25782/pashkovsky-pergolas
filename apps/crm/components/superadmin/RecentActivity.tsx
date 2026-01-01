/**
 * Recent Activity Component
 */

'use client'

import { Clock, Building2, CreditCard, UserPlus, Trash2, Settings as SettingsIcon, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

interface ActivityLog {
  id: string
  event_type: string
  payload: any
  created_at: string
  companies?: { name: string } | null
}

export function RecentActivity() {
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchActivities()
  }, [])

  async function fetchActivities() {
    try {
      const res = await fetch('/api/platform/activity', {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setActivities(data)
      }
    } catch (error) {
      console.error('[Recent Activity] Error:', error)
    } finally {
      setLoading(false)
    }
  }

  function getActivityConfig(type: string) {
    switch (type) {
      case 'company_created':
        return {
          icon: Building2,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          label: 'New Company'
        }
      case 'company_deleted':
        return {
          icon: Trash2,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          label: 'Company Deleted'
        }
      case 'plan_changed':
        return {
          icon: CreditCard,
          color: 'text-purple-600',
          bgColor: 'bg-purple-50',
          label: 'Plan Changed'
        }
      case 'payment_confirmed':
        return {
          icon: CreditCard,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          label: 'Payment'
        }
      case 'admin_added':
        return {
          icon: UserPlus,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          label: 'Admin Added'
        }
      case 'admin_deactivated':
        return {
          icon: XCircle,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          label: 'Admin Deactivated'
        }
      case 'settings_updated':
        return {
          icon: SettingsIcon,
          color: 'text-indigo-600',
          bgColor: 'bg-indigo-50',
          label: 'Settings Updated'
        }
      default:
        return {
          icon: Clock,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          label: type
        }
    }
  }

  function getActivityTitle(activity: ActivityLog): string {
    const companyName = activity.companies?.name || 'Unknown Company'
    
    switch (activity.event_type) {
      case 'company_created':
        return `New company registered: ${companyName}`
      case 'company_deleted':
        return `Company deleted: ${companyName}`
      case 'plan_changed':
        return `${companyName} changed subscription plan`
      case 'payment_confirmed':
        return `Payment confirmed for ${companyName}`
      case 'admin_added':
        return `New admin added`
      case 'admin_deactivated':
        return `Admin deactivated`
      case 'settings_updated':
        return `Platform settings updated`
      default:
        return activity.event_type
    }
  }

  function getTimeAgo(date: string): string {
    const now = new Date()
    const then = new Date(date)
    const seconds = Math.floor((now.getTime() - then.getTime()) / 1000)

    if (seconds < 60) return 'Just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`
    return then.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
      
      {activities.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Clock className="h-12 w-12 mx-auto mb-2 text-gray-300" />
          <p>No recent activity</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activities.map((activity) => {
            const config = getActivityConfig(activity.event_type)
            const Icon = config.icon
            
            return (
              <div key={activity.id} className="flex items-start gap-3">
                <div className={`p-2 ${config.bgColor} rounded-lg`}>
                  <Icon className={`h-4 w-4 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {getActivityTitle(activity)}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <Clock className="h-3 w-3 text-gray-400" />
                    <span className="text-xs text-gray-500">
                      {getTimeAgo(activity.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      
      <button className="w-full mt-4 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
        View All Activity
      </button>
    </div>
  )
}


