/**
 * Subscriptions Management
 * View all subscriptions and billing
 */

import { createClient } from '@supabase/supabase-js'
import { CreditCard, TrendingUp, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react'
import { getMRR } from '@/lib/utils/mrr'

async function getAllCompanies() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
  
  const { data: companies, error } = await supabase
    .from('companies')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('[Companies] Error loading:', error)
    return []
  }
  
  return companies || []
}

async function getSubscriptions() {
  // Use SERVICE_ROLE_KEY to bypass RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
  
  const { data: subscriptions, error } = await supabase
    .from('company_subscriptions')
    .select(`
      id,
      company_id,
      plan_id,
      status,
      billing_cycle,
      created_at,
      updated_at,
      companies (
        name,
        primary_email
      ),
      subscription_plans (
        plan_key,
        display_name,
        price_monthly,
        price_yearly
      )
    `)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('[Subscriptions] Error loading:', error)
    return []
  }
  
  return subscriptions || []
}

async function getSubscriptionPlans() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
  
  const { data: plans, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('price_monthly', { ascending: true })
  
  if (error) {
    console.error('[Plans] Error loading:', error)
    return []
  }
  
  return plans || []
}

// Helper to get display name from JSONB (supports i18n)
function getDisplayName(nameObj: any): string {
  if (typeof nameObj === 'string') return nameObj
  if (typeof nameObj === 'object' && nameObj !== null) {
    // Try English first, then Hebrew, then Russian, then first available
    return nameObj.en || nameObj.he || nameObj.ru || Object.values(nameObj)[0] || 'Unknown'
  }
  return 'Unknown'
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Active' }
    case 'trialing':
      return { color: 'bg-blue-100 text-blue-800', icon: Clock, label: 'Trial' }
    case 'past_due':
      return { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Past Due' }
    case 'canceled':
      return { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Canceled' }
    default:
      return { color: 'bg-gray-100 text-gray-800', icon: Clock, label: status }
  }
}

export default async function SubscriptionsPage() {
  const subscriptions = await getSubscriptions()
  const plans = await getSubscriptionPlans()
  const allCompanies = await getAllCompanies()
  
  // Calculate stats
  const activeSubscriptions = subscriptions.filter(s => s.status === 'active').length
  const trialSubscriptions = subscriptions.filter(s => s.status === 'trialing').length
  
  // Calculate MRR using utility function
  const mrr = await getMRR()
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Subscriptions</h1>
          <p className="text-gray-600 mt-1">Manage all company subscriptions and plans</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Subscriptions</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{subscriptions.length}</p>
            </div>
            <CreditCard className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{activeSubscriptions}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Trial</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{trialSubscriptions}</p>
            </div>
            <Clock className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">MRR</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">₪{Math.round(mrr).toLocaleString()}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">All Subscriptions</h2>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Company
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Plan
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Billing
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Revenue
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {subscriptions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  No subscriptions found
                </td>
              </tr>
            ) : (
              subscriptions.map((subscription: any) => {
                const statusBadge = getStatusBadge(subscription.status)
                const StatusIcon = statusBadge.icon
                const plan = subscription.subscription_plans
                const company = subscription.companies
                const revenue = subscription.billing_cycle === 'yearly' 
                  ? plan?.price_yearly 
                  : plan?.price_monthly
                
                return (
                  <tr key={subscription.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {company?.name || 'Unknown Company'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {company?.primary_email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {plan ? getDisplayName(plan.display_name) : plan?.plan_key || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {subscription.billing_cycle === 'yearly' ? 'Yearly' : 'Monthly'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {statusBadge.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {subscription.created_at 
                        ? new Date(subscription.created_at).toLocaleDateString()
                        : '-'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {revenue ? `₪${revenue}/mo` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-blue-600 hover:text-blue-900 mr-4">
                        View
                      </button>
                      <button className="text-gray-600 hover:text-gray-900">
                        Manage
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* All Companies & Plans Overview */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">All Companies & Plans</h2>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Company
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Current Plan
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
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
            {allCompanies.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  No companies found
                </td>
              </tr>
            ) : (
              allCompanies.map((company: any) => (
                <tr key={company.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {company.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {company.primary_email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {company.plan || 'trial'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      company.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {company.status || 'trial'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(company.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button className="text-blue-600 hover:text-blue-900 mr-4">
                      Change Plan
                    </button>
                    <button className="text-gray-600 hover:text-gray-900">
                      View Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Available Plans */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {plans.length === 0 ? (
            <p className="text-gray-500 col-span-4 text-center py-4">No plans configured</p>
          ) : (
            plans.map((plan: any) => (
              <div key={plan.id} className="border rounded-lg p-4">
                <h3 className="font-semibold text-gray-900">{getDisplayName(plan.display_name)}</h3>
                <p className="text-2xl font-bold text-blue-600 mt-2">
                  ₪{plan.price_monthly}
                  <span className="text-sm text-gray-500">/mo</span>
                </p>
                {plan.price_yearly && (
                  <p className="text-sm text-gray-500 mt-1">
                    or ₪{plan.price_yearly}/year
                  </p>
                )}
                <div className="mt-4 space-y-2">
                  {plan.max_users && (
                    <p className="text-sm text-gray-600">• {plan.max_users} users</p>
                  )}
                  {plan.max_deals && (
                    <p className="text-sm text-gray-600">• {plan.max_deals} deals/mo</p>
                  )}
                  {plan.max_storage_gb && (
                    <p className="text-sm text-gray-600">• {plan.max_storage_gb}GB storage</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
