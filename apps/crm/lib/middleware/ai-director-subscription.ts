/**
 * AI Director (Bedrock) — gated by per-user SaaS plan (growth+).
 */

import { NextResponse } from 'next/server'
import { getUserSubscriptionPlan } from '@/lib/subscription/load-user-plan'
import { hasAccess } from '@/lib/subscription/plan-access'

/**
 * @param userId — Supabase auth user id
 * @returns null if allowed, or a 403 NextResponse
 */
export async function checkAIDirectorAccess(userId: string): Promise<NextResponse | null> {
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'PLAN_REQUIRED', required_plan: 'growth' },
      { status: 403 },
    )
  }

  const plan = await getUserSubscriptionPlan(userId)
  if (!hasAccess({ plan }, 'ai_director')) {
    return NextResponse.json(
      {
        error: 'AI Director is not available on your current plan.',
        code: 'PLAN_REQUIRED',
        required_plan: 'growth',
        current_plan: plan,
      },
      { status: 403 },
    )
  }

  return null
}
