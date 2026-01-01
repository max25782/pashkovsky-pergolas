/**
 * MRR (Monthly Recurring Revenue) Utility
 * Calculate real MRR from active subscriptions
 */

import { createClient } from '@supabase/supabase-js'

export async function getMRR(): Promise<number> {
  try {
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

    // Get all active subscriptions with their plan prices
    const { data: subscriptions, error } = await supabase
      .from('company_subscriptions')
      .select(`
        id,
        billing_cycle,
        subscription_plans (
          price_monthly
        )
      `)
      .eq('status', 'active')

    if (error) {
      console.error('[getMRR] Error:', error)
      return 0
    }

    if (!subscriptions || subscriptions.length === 0) {
      return 0
    }

    // Calculate MRR (only monthly billing as per requirements)
    let mrr = 0
    subscriptions.forEach((sub: any) => {
      const plan = sub.subscription_plans
      if (plan?.price_monthly) {
        mrr += plan.price_monthly
      }
    })

    return Math.round(mrr)
  } catch (error) {
    console.error('[getMRR] Exception:', error)
    return 0
  }
}

/**
 * Get MRR breakdown by plan
 */
export async function getMRRBreakdown() {
  try {
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
        billing_cycle,
        subscription_plans (
          plan_key,
          display_name,
          price_monthly
        )
      `)
      .eq('status', 'active')

    if (error || !subscriptions) {
      return []
    }

    // Group by plan
    const breakdown = new Map<string, { planKey: string, displayName: any, revenue: number, count: number }>()

    subscriptions.forEach((sub: any) => {
      const plan = sub.subscription_plans
      if (!plan) return

      const key = plan.plan_key
      const existing = breakdown.get(key)

      if (existing) {
        existing.revenue += plan.price_monthly || 0
        existing.count += 1
      } else {
        breakdown.set(key, {
          planKey: key,
          displayName: plan.display_name,
          revenue: plan.price_monthly || 0,
          count: 1
        })
      }
    })

    return Array.from(breakdown.values())
  } catch (error) {
    console.error('[getMRRBreakdown] Exception:', error)
    return []
  }
}

