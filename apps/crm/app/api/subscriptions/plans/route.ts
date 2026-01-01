// ==========================================
// GET /api/subscriptions/plans
// ==========================================
// Thin controller - вся логика в service

import { NextRequest, NextResponse } from 'next/server'
import { subscriptionService } from '@/lib/services/subscription-service'
import { createClient } from '@/lib/supabase/server'
import type { GetPlansResponse } from '@/types/subscription'
import type { CompanyMember } from '@/types/membership'

export const dynamic = 'force-dynamic'

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

    // Get company_id from company_members
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .single<Pick<CompanyMember, 'company_id'>>()
    
    if (!membership) {
      return NextResponse.json(
        { error: 'No company found' },
        { status: 404 }
      )
    }

    // Get all plans
    const plans = await subscriptionService.getPlans()
    
    // Get current plan key
    const currentPlan = await subscriptionService.getCurrentPlan(membership.company_id)
    
    const response: GetPlansResponse = {
      plans,
      current_plan_key: currentPlan?.plan_key
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

