/**
 * SaaS plan feature gating (billing integration later).
 *
 * @example
 * import { hasAccess } from '@/lib/subscription'
 * if (!hasAccess({ plan: user.plan }, 'deals')) { ... }
 */

export {
  hasAccess,
  normalizePlan,
  minPlanForFeature,
  upgradePlanForFeature,
  PLAN_ORDER,
} from '@/lib/subscription/plan-access'
export type { SaasFeature, SubscriptionPlan, UserPlanContext } from '@/lib/subscription/plan-types'
export { getUserSubscriptionPlan } from '@/lib/subscription/load-user-plan'
export { assertUserHasFeature, planRequiredResponse } from '@/lib/subscription/require-feature-api'
