import type { SaasFeature, SubscriptionPlan, UserPlanContext } from '@/lib/subscription/plan-types'

export const PLAN_ORDER: Record<SubscriptionPlan, number> = {
  offer: 0,
  pro: 1,
  business: 2,
  growth: 3,
}

// Plan mapping to landing page:
//   offer    = Quick Offer only (free/lite tier)
//   pro      = Starter ($89/mo)     — 1 user, 200 deals, CRM core
//   business = Professional ($229/mo) — 5 users, unlimited deals, AI assistant, analytics
//   growth   = Enterprise ($349/mo) — unlimited users, full AI, custom integrations
const FEATURE_MIN_PLAN: Record<SaasFeature, SubscriptionPlan> = {
  quick_offer:       'offer',
  crm_home:          'pro',
  deals:             'pro',
  clients:           'pro',
  save_offer_to_crm: 'pro',
  gallery:           'pro',
  articles:          'pro',
  leads:             'business',
  statistics:        'business',
  reports_finance:   'business',
  workers:           'business',
  inventory:         'business',
  material_orders:   'business',
  profiles_catalog:  'business',
  ai_chat:           'business',   // Professional plan includes AI assistant
  ai_analytics:      'business',   // Professional plan includes Analytics & reports
  ai_media:          'growth',
  ai_director:       'growth',
  integrations:      'growth',     // Enterprise: Custom integrations / API access
}

export function normalizePlan(value: unknown): SubscriptionPlan {
  if (value === 'offer' || value === 'pro' || value === 'business' || value === 'growth') {
    return value
  }
  return 'offer'
}

export function hasAccess(
  user: UserPlanContext,
  feature: SaasFeature,
  memberRole?: string | null,
): boolean {
  if (memberRole === 'salesperson') {
    return SALESPERSON_PLAN_FEATURES.includes(feature)
  }
  const need = FEATURE_MIN_PLAN[feature]
  return PLAN_ORDER[user.plan] >= PLAN_ORDER[need]
}

/** Features unlocked for salesperson by role — same company data, no Business plan. */
export const SALESPERSON_PLAN_FEATURES: readonly SaasFeature[] = [
  'crm_home',
  'leads',
  'quick_offer',
]

export function minPlanForFeature(feature: SaasFeature): SubscriptionPlan {
  return FEATURE_MIN_PLAN[feature]
}

/** Next plan tier name for upgrade copy (single step). */
export function upgradePlanForFeature(feature: SaasFeature): SubscriptionPlan {
  return minPlanForFeature(feature)
}
