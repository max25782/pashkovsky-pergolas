// ==========================================
// GET /api/subscriptions/current
// ==========================================
// Get current subscription + plan + usage

import { NextRequest, NextResponse } from 'next/server'
import { subscriptionService } from '@/lib/services/subscription-service'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import type { GetCurrentSubscriptionResponse } from '@/types/subscription'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    // Auth check
    const authResult = await requireAuthAsync(req)
    if (!authResult.authorized) {
      return authResult.error
    }

    const company_id = authResult.context.companyId
    if (!company_id) {
      return NextResponse.json(
        { error: 'No company found' },
        { status: 404 }
      )
    }

    // Get current subscription (may be null for newly created companies)
    const subscription = await subscriptionService.getCurrentSubscription(company_id)

    // Get plan details (service falls back to trial plan when subscription is missing)
    const plan = await subscriptionService.getCurrentPlan(company_id)
    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 500 }
      )
    }

    // Get usage (optional)
    const includeUsage = req.nextUrl.searchParams.get('include_usage') === 'true'
    const usageData = includeUsage ? await subscriptionService.getUsage(company_id) : undefined

    const response: GetCurrentSubscriptionResponse = {
      subscription,
      plan,
      usage: usageData ?? undefined
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
