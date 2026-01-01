/**
 * Subscription Distribution Chart
 */

'use client'

interface SubscriptionChartProps {
  planDistribution: any[]
}

export function SubscriptionChart({ planDistribution }: SubscriptionChartProps) {
  // Count subscriptions by plan
  const planCounts = planDistribution.reduce((acc: any, sub: any) => {
    const planKey = sub.subscription_plans?.plan_key || 'unknown'
    acc[planKey] = (acc[planKey] || 0) + 1
    return acc
  }, {})

  const total = planDistribution.length
  
  const plans = [
    { key: 'trial', name: 'Trial', color: 'bg-gray-500' },
    { key: 'basic', name: 'Basic', color: 'bg-blue-500' },
    { key: 'pro', name: 'Pro', color: 'bg-purple-500' },
    { key: 'enterprise', name: 'Enterprise', color: 'bg-yellow-500' },
  ]

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Subscription Distribution</h3>
      
      <div className="space-y-4">
        {plans.map((plan) => {
          const count = planCounts[plan.key] || 0
          const percentage = total > 0 ? Math.round((count / total) * 100) : 0
          
          return (
            <div key={plan.key}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{plan.name}</span>
                <span className="text-sm text-gray-600">
                  {count} ({percentage}%)
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`${plan.color} h-2 rounded-full transition-all duration-300`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
      
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Total Subscriptions</span>
          <span className="text-lg font-bold text-gray-900">{total}</span>
        </div>
      </div>
    </div>
  )
}

