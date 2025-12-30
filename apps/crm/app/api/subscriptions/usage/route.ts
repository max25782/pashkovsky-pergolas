// ==========================================
// GET /api/subscriptions/usage
// ==========================================
// Get detailed usage information

import { NextRequest, NextResponse } from 'next/server'
import { subscriptionService } from '@/lib/services/subscription-service'
import { createClient } from '@/lib/supabase/server'
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

    // Get company_id
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

    // Get usage
    const usage = await subscriptionService.getUsage(membership.company_id)
    
    if (!usage) {
      return NextResponse.json(
        { error: 'Unable to calculate usage' },
        { status: 500 }
      )
    }

    return NextResponse.json(usage)
  } catch (error) {
    console.error('[API] Get usage error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

