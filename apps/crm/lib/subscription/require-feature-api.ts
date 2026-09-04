import { NextResponse } from 'next/server'
import { getUserSubscriptionPlan, getUserCompanyRole } from '@/lib/subscription/load-user-plan'
import { hasAccess, minPlanForFeature } from '@/lib/subscription/plan-access'
import type { SaasFeature } from '@/lib/subscription/plan-types'

export function planRequiredResponse(feature: SaasFeature): NextResponse {
  const requiredPlan = minPlanForFeature(feature)
  return NextResponse.json(
    {
      error: 'This feature is not available on your current plan.',
      code: 'PLAN_REQUIRED',
      feature,
      required_plan: requiredPlan,
    },
    { status: 403 },
  )
}

export async function assertUserHasFeature(
  userId: string,
  feature: SaasFeature,
): Promise<NextResponse | null> {
  const [plan, role] = await Promise.all([
    getUserSubscriptionPlan(userId),
    getUserCompanyRole(userId),
  ])
  if (!hasAccess({ plan }, feature, role)) return planRequiredResponse(feature)
  return null
}
