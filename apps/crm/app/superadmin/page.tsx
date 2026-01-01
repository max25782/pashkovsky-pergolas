/**
 * SuperAdmin Dashboard
 * Platform-wide statistics and overview
 */

import { createClient } from '@supabase/supabase-js'
import { StatCard } from '@/components/superadmin/StatCard'
import { RecentActivity } from '@/components/superadmin/RecentActivity'
import { SubscriptionChart } from '@/components/superadmin/SubscriptionChart'
import { getMRR } from '@/lib/utils/mrr'

async function getPlatformStats() {
  // Use SERVICE_ROLE_KEY to bypass RLS (SuperAdmin has full access)
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
  
  // Total companies
  const { count: companiesCount } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true })
  
  // Total users (company members)
  const { count: usersCount } = await supabase
    .from('company_members')
    .select('*', { count: 'exact', head: true })
  
  // Active subscriptions
  const { count: activeSubscriptions } = await supabase
    .from('company_subscriptions')
    .select('*', { count: 'exact', head: true })
    .in('status', ['active', 'trialing'])
  
  // Subscriptions by plan
  const { data: planDistribution } = await supabase
    .from('company_subscriptions')
    .select(`
      plan_id,
      subscription_plans (plan_key, display_name)
    `)
  
  // Calculate MRR using utility function
  const mrr = await getMRR()
  
  return {
    companiesCount: companiesCount || 0,
    usersCount: usersCount || 0,
    activeSubscriptions: activeSubscriptions || 0,
    mrr,
    planDistribution: planDistribution || []
  }
}

export default async function SuperAdminDashboard() {
  const stats = await getPlatformStats()
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Platform Dashboard</h1>
        <p className="text-gray-600 mt-1">Overview of your SaaS platform</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Companies"
          value={stats.companiesCount}
          iconName="building"
          trend="+12%"
          trendUp={true}
        />
        <StatCard
          title="Total Users"
          value={stats.usersCount}
          iconName="users"
          trend="+8%"
          trendUp={true}
        />
        <StatCard
          title="Active Subscriptions"
          value={stats.activeSubscriptions}
          iconName="card"
          trend="+5%"
          trendUp={true}
        />
        <StatCard
          title="MRR"
          value={`₪${stats.mrr.toLocaleString()}`}
          iconName="dollar"
          trend="+15%"
          trendUp={true}
        />
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SubscriptionChart planDistribution={stats.planDistribution} />
        <RecentActivity />
      </div>
    </div>
  )
}

