/**
 * Subscriptions Table Component
 */

'use client'

import { useState } from 'react'
import { Building2, Calendar, CreditCard, DollarSign, MoreVertical } from 'lucide-react'
import Link from 'next/link'

interface Subscription {
  id: string
  company_id: string
  plan_id: string
  status: string
  billing_cycle?: string
  auto_renew: boolean
  current_period_end?: string
  created_at: string
  companies?: any
  subscription_plans?: any
}

interface SubscriptionsTableProps {
  subscriptions: Subscription[]
}

export function SubscriptionsTable({ subscriptions }: SubscriptionsTableProps) {
  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      trialing: 'bg-blue-100 text-blue-800',
      past_due: 'bg-yellow-100 text-yellow-800',
      canceled: 'bg-red-100 text-red-800',
      suspended: 'bg-gray-100 text-gray-800',
    }
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || styles.suspended}`}>
        {status}
      </span>
    )
  }
  
  const getPlanBadge = (planKey: string) => {
    const styles = {
      trial: 'bg-gray-100 text-gray-800',
      basic: 'bg-blue-100 text-blue-800',
      pro: 'bg-purple-100 text-purple-800',
      enterprise: 'bg-yellow-100 text-yellow-800',
    }
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[planKey as keyof typeof styles] || styles.trial}`}>
        {planKey}
      </span>
    )
  }
  
  const getPrice = (sub: Subscription) => {
    const plan = sub.subscription_plans
    if (!plan) return '₪0'
    
    if (sub.billing_cycle === 'yearly' && plan.price_yearly) {
      return `₪${plan.price_yearly}/year`
    }
    
    return `₪${plan.price_monthly || 0}/month`
  }
  
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Company
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Plan
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Renews
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {subscriptions.map((sub) => {
              const company = sub.companies
              const plan = sub.subscription_plans
              
              return (
                <tr key={sub.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">
                          {company?.name || 'Unknown'}
                        </div>
                        <div className="text-sm text-gray-500">{company?.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {plan && getPlanBadge(plan.plan_key)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(sub.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-sm text-gray-900">
                      <DollarSign className="h-4 w-4 text-gray-400" />
                      {getPrice(sub)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {sub.auto_renew ? (
                        <span className="text-green-600">Yes</span>
                      ) : (
                        <span className="text-gray-500">No</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      {new Date(sub.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button className="text-blue-600 hover:text-blue-900">
                      Manage
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
        <div className="text-sm text-gray-700">
          Showing <span className="font-medium">{subscriptions.length}</span> subscriptions
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 text-sm">
            Previous
          </button>
          <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 text-sm">
            Next
          </button>
        </div>
      </div>
    </div>
  )
}

