// ==========================================
// GET /api/subscriptions/history
// ==========================================
// Get subscription change history

import { NextRequest, NextResponse } from 'next/server'
import { subscriptionService } from '@/lib/services/subscription-service'
import { createClient } from '@/lib/supabase/server'
import type { GetHistoryResponse } from '@/types/subscription'

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

    // Get limit from query params
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50')

    // Get history
    const history = await subscriptionService.getHistory(company_id, limit)

    // Enrich with plan details
    const enrichedHistory = await Promise.all(
      history.map(async (record) => {
        const oldPlan = record.old_plan_id 
          ? await supabase.from('subscription_plans').select('*').eq('id', record.old_plan_id).single()
          : null
        
        const newPlan = await supabase
          .from('subscription_plans')
          .select('*')
          .eq('id', record.new_plan_id)
          .single()

        return {
          ...record,
          old_plan: oldPlan?.data || undefined,
          new_plan: newPlan.data
        }
      })
    )

    const response: GetHistoryResponse = {
      history: enrichedHistory,
      total: history.length
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[API] Get history error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

