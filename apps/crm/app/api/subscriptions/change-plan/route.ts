// ==========================================
// POST /api/subscriptions/change-plan
// ==========================================
// Change subscription plan (manual or via payment)

import { NextRequest, NextResponse } from 'next/server'
import { subscriptionService } from '@/lib/services/subscription-service'
import { createClient } from '@/lib/supabase/server'
import type { ChangePlanDTO, ChangePlanResponse } from '@/types/subscription'
import type { CompanyMember } from '@/types/membership'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
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

    // Get company_id and check permissions
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id, role, permissions')
      .eq('user_id', user.id)
      .single<Pick<CompanyMember, 'company_id' | 'role' | 'permissions'>>()
    
    if (!membership) {
      return NextResponse.json(
        { error: 'No company found' },
        { status: 404 }
      )
    }

    // Check if user has permission to change plan
    const hasPermission = membership.role === 'owner' || 
                         membership.role === 'admin' ||
                         membership.permissions?.all === true

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Parse request body
    const body: ChangePlanDTO = await req.json()
    
    if (!body.new_plan_key) {
      return NextResponse.json(
        { error: 'Missing new_plan_key' },
        { status: 400 }
      )
    }

    // Change plan
    const subscription = await subscriptionService.changePlan(
      membership.company_id,
      user.id,
      body
    )

    const response: ChangePlanResponse = {
      success: true,
      subscription,
      message: `Plan changed to ${body.new_plan_key}`
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[API] Change plan error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

