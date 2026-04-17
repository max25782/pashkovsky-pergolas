// ==========================================
// Subscription Types & DTOs
// ==========================================
// Готово к миграции на NestJS

export interface SubscriptionPlan {
  id: string
  plan_key: 'trial' | 'basic' | 'pro' | 'enterprise'
  display_name: {
    en: string
    he: string
    ru: string
  }
  price_monthly: number
  price_yearly?: number
  features: string[]
  limits: {
    users: number // -1 = unlimited
    deals: number // -1 = unlimited
    storage_gb: number
    ai_requests_per_month: number // -1 = unlimited
  }
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface CompanySubscription {
  id: string
  company_id: string
  plan_id: string
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'suspended'
  payment_provider?: 'stripe' | 'manual' | 'bit' | 'paybox' | 'paypal'
  payment_provider_subscription_id?: string
  payment_provider_customer_id?: string
  billing_cycle?: 'monthly' | 'yearly'
  auto_renew: boolean
  trial_ends_at?: string
  current_period_end?: string
  next_billing_date?: string
  canceled_at?: string
  created_at: string
  updated_at: string
}

export interface SubscriptionHistory {
  id: string
  company_id: string
  old_plan_id?: string
  new_plan_id: string
  changed_by: string
  change_reason?: string
  created_at: string
}

// DTOs for API requests
export interface ChangePlanDTO {
  new_plan_key: string
  billing_cycle?: 'monthly' | 'yearly'
  reason?: string
}

export interface SubscriptionUsage {
  users: {
    current: number
    limit: number
    percentage: number
  }
  deals: {
    current: number
    limit: number
    percentage: number
  }
  storage: {
    current_gb: number
    limit_gb: number
    percentage: number
  }
  ai_requests: {
    current_month: number
    limit: number
    percentage: number
  }
}

// Response DTOs
export interface GetCurrentSubscriptionResponse {
  subscription: CompanySubscription
  plan: SubscriptionPlan
  usage?: SubscriptionUsage
}

export interface GetPlansResponse {
  plans: SubscriptionPlan[]
  current_plan_key?: string
}

export interface ChangePlanResponse {
  success: boolean
  subscription: CompanySubscription
  message: string
}

export interface GetHistoryResponse {
  history: (SubscriptionHistory & {
    old_plan?: SubscriptionPlan
    new_plan: SubscriptionPlan
  })[]
  total: number
}

export interface PlanLimitCheck {
  limit_type: 'users' | 'deals' | 'storage'
  current_usage: number
  current: number
  limit: number | null
  is_unlimited: boolean
  is_exceeded: boolean
  percentage_used: number
  allowed: boolean
  plan: string
}
