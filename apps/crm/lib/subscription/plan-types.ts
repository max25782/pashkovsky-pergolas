export type SubscriptionPlan = 'offer' | 'pro' | 'business' | 'growth'

/** Named product capabilities — map to minimum plan in plan-access. */
export type SaasFeature =
  | 'quick_offer'
  | 'crm_home'
  | 'leads'
  | 'deals'
  | 'clients'
  | 'save_offer_to_crm'
  | 'gallery'
  | 'articles'
  | 'ai_media'
  | 'statistics'
  | 'reports_finance'
  | 'workers'
  | 'inventory'
  | 'material_orders'
  | 'profiles_catalog'
  | 'ai_director'
  | 'ai_chat'
  | 'ai_analytics'
  | 'integrations'

export interface UserPlanContext {
  plan: SubscriptionPlan
}
