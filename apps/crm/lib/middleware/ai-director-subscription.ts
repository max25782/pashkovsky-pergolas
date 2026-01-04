/**
 * Check if company has access to AI Director (Bedrock) feature
 * AI Director is available only for Pro and Enterprise plans
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY)
  : undefined

/**
 * Plans that have access to AI Director (Bedrock)
 */
const AI_DIRECTOR_ALLOWED_PLANS = ['pro', 'enterprise']

/**
 * Check if company has access to AI Director
 * Returns null if allowed, error response if not
 */
export async function checkAIDirectorAccess(companyId: string): Promise<NextResponse | null> {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Server not configured' },
      { status: 500 }
    )
  }

  try {
    // Get company subscription
    const { data: subscription, error: subError } = await supabase
      .from('company_subscriptions')
      .select(`
        id,
        status,
        plan_id,
        subscription_plans:plan_id (
          plan_key,
          display_name
        )
      `)
      .eq('company_id', companyId)
      .eq('status', 'active')
      .single()

    if (subError || !subscription) {
      return NextResponse.json(
        {
          error: 'AI Director недоступен',
          message: 'У вас нет активной подписки. AI Director доступен только для планов Pro и Enterprise.',
          upgrade_required: true,
          allowed_plans: AI_DIRECTOR_ALLOWED_PLANS,
        },
        { status: 403 }
      )
    }

    // Check if subscription is active
    if (subscription.status !== 'active') {
      return NextResponse.json(
        {
          error: 'AI Director недоступен',
          message: 'Ваша подписка неактивна. AI Director доступен только для активных планов Pro и Enterprise.',
          upgrade_required: true,
          allowed_plans: AI_DIRECTOR_ALLOWED_PLANS,
        },
        { status: 403 }
      )
    }

    // Get plan key
    const plan = subscription.subscription_plans as any
    const planKey = plan?.plan_key

    if (!planKey || !AI_DIRECTOR_ALLOWED_PLANS.includes(planKey)) {
      return NextResponse.json(
        {
          error: 'AI Director недоступен',
          message: `AI Director доступен только для планов Pro и Enterprise. Ваш текущий план: ${plan?.display_name?.ru || planKey || 'неизвестен'}`,
          upgrade_required: true,
          current_plan: planKey,
          allowed_plans: AI_DIRECTOR_ALLOWED_PLANS,
        },
        { status: 403 }
      )
    }

    // Access granted
    return null
  } catch (error: any) {
    console.error('[AI Director] Subscription check error:', error)
    return NextResponse.json(
      {
        error: 'Ошибка проверки доступа',
        message: 'Не удалось проверить доступ к AI Director',
      },
      { status: 500 }
    )
  }
}

