// ==========================================
// GET /api/subscriptions/current
// ==========================================
// Get current subscription + plan + usage

import { NextRequest, NextResponse } from 'next/server'
import { subscriptionService } from '@/lib/services/subscription-service'
import { createClient } from '@/lib/supabase/server'
import type { GetCurrentSubscriptionResponse } from '@/types/subscription'

export async function GET(req: NextRequest) {
  try {
    // Auth check
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get company_id
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .single()
    
    if (!membership) {
      return NextResponse.json(
        { error: 'No company found' },
        { status: 404 }
      )
    }

    const company_id = membership.company_id

    // Get current subscription
    const subscription = await subscriptionService.getCurrentSubscription(company_id)
    if (!subscription) {
      return NextResponse.json(
        { error: 'No active subscription' },
        { status: 404 }
      )
    }

    // Get plan details
    const plan = await subscriptionService.getCurrentPlan(company_id)
    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      )
    }

    // Get usage (optional)
    const includeUsage = req.nextUrl.searchParams.get('include_usage') === 'true'
    const usage = includeUsage ? await subscriptionService.getUsage(company_id) : undefined

    const response: GetCurrentSubscriptionResponse = {
      subscription,
      plan,
      usage
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[API] Get current subscription error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

