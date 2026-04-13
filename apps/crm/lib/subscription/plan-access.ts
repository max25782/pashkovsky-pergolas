import type { SaasFeature, SubscriptionPlan, UserPlanContext } from '@/lib/subscription/plan-types'

export const PLAN_ORDER: Record<SubscriptionPlan, number> = {
  offer: 0,
  pro: 1,
  business: 2,
  growth: 3,
}

const FEATURE_MIN_PLAN: Record<SaasFeature, SubscriptionPlan> = {
  quick_offer: 'offer',
  crm_home: 'pro',
  leads: 'business',
  deals: 'pro',
  clients: 'pro',
  save_offer_to_crm: 'pro',
  gallery: 'pro',
  articles: 'pro',
  ai_media: 'growth',
  statistics: 'business',
  reports_finance: 'business',
  workers: 'business',
  inventory: 'business',
  material_orders: 'business',
  profiles_catalog: 'business',
  ai_director: 'growth',
  ai_chat: 'growth',
  ai_analytics: 'growth',
  integrations: 'growth',
}

export function normalizePlan(value: unknown): SubscriptionPlan {
  if (value === 'offer' || value === 'pro' || value === 'business' || value === 'growth') {
    return value
  }
  return 'offer'
}

export function hasAccess(user: UserPlanContext, feature: SaasFeature): boolean {
  const need = FEATURE_MIN_PLAN[feature]
  return PLAN_ORDER[user.plan] >= PLAN_ORDER[need]
}

export function minPlanForFeature(feature: SaasFeature): SubscriptionPlan {
  return FEATURE_MIN_PLAN[feature]
}

/** Next plan tier name for upgrade copy (single step). */
export function upgradePlanForFeature(feature: SaasFeature): SubscriptionPlan {
  return minPlanForFeature(feature)
}
