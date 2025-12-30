// ==========================================
// GET /api/public/subscriptions/plans
// ==========================================
// Public endpoint - no auth required

import { NextRequest, NextResponse } from 'next/server'
import { subscriptionService } from '@/lib/services/subscription-service'
import type { GetPlansResponse } from '@/types/subscription'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    // Get all plans (no auth needed)
    const plans = await subscriptionService.getPlans()
    
    const response: GetPlansResponse = {
      plans
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[API] Get plans error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

