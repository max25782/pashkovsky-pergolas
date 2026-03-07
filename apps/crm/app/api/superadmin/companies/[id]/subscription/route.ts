/**
 * SuperAdmin API - Get Company Subscription
 * Debug endpoint to check subscription data
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const resolvedParams = await context.params
    const companyId = resolvedParams.id


    // Fetch subscription with plan details
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('company_subscriptions')
      .select(`
        *,
        subscription_plans (
          id,
          plan_key,
          display_name,
          price_monthly,
          price_yearly
        )
      `)
      .eq('company_id', companyId)
      .limit(1)

    // Fetch subscription history
    const { data: history, error: historyError } = await supabaseAdmin
      .from('subscription_history')
      .select(`
        *,
        subscription_plans!subscription_history_new_plan_id_fkey (
          plan_key,
          display_name
        )
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      success: true,
      subscription: subscription?.[0] || null,
      history: history || [],
      debug: {
        companyId,
        subscriptionFound: !!subscription?.[0],
        historyCount: history?.length || 0,
      },
    })
  } catch (error: unknown) {
    console.error('[SuperAdmin] Error fetching subscription:', error)
    return NextResponse.json(
      {
        success: false,
        error: (error instanceof Error ? error.message : String(error)) || 'Failed to fetch subscription',
      },
      { status: 500 }
    )
  }
}

