// ==========================================
// Subscription Service
// ==========================================
// Service layer готов к миграции на NestJS (injectable)
// Вся бизнес-логика здесь, контроллеры тонкие

import { createClient } from '@/lib/supabase/server'
import type {
  SubscriptionPlan,
  CompanySubscription,
  SubscriptionHistory,
  ChangePlanDTO,
  SubscriptionUsage,
} from '@/types/subscription'

export class SubscriptionMutationDisabledError extends Error {
  constructor(operation: string) {
    super(`Subscription ${operation} is disabled`)
    this.name = 'SubscriptionMutationDisabledError'
  }
}

export class SubscriptionService {
  /**
   * Get all available subscription plans
   */
  async getPlans(): Promise<SubscriptionPlan[]> {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
    
    if (error) {
      throw new Error(`Failed to fetch plans: ${error.message}`)
    }
    
    return data as SubscriptionPlan[]
  }

  /**
   * Get plan by key
   */
  async getPlanByKey(plan_key: string): Promise<SubscriptionPlan | null> {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('plan_key', plan_key)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw new Error(`Failed to fetch plan: ${error.message}`)
    }
    
    return data as SubscriptionPlan
  }

  /**
   * Get current subscription for company
   */
  async getCurrentSubscription(company_id: string): Promise<CompanySubscription | null> {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('company_subscriptions')
      .select('*')
      .eq('company_id', company_id)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw new Error(`Failed to fetch subscription: ${error.message}`)
    }
    
    return data as CompanySubscription
  }

  /**
   * Get current plan for company
   */
  async getCurrentPlan(company_id: string): Promise<SubscriptionPlan | null> {
    const subscription = await this.getCurrentSubscription(company_id)
    if (!subscription || !subscription.plan_id) return null
    
    const supabase = createClient()
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', subscription.plan_id)
      .single()
    
    if (error) return null
    return data as SubscriptionPlan
  }

  /**
   * Get subscription usage/limits for company
   */
  async getUsage(company_id: string): Promise<SubscriptionUsage | null> {
    const plan = await this.getCurrentPlan(company_id)
    if (!plan) return null
    
    const supabase = createClient()
    
    // Get current users count
    const { count: usersCount } = await supabase
      .from('company_members')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', company_id)
    
    // Get current deals count
    const { count: dealsCount } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', company_id)
    
    // Calculate storage (placeholder - implement actual storage calculation)
    const currentStorageGb = 0 // TODO: Calculate actual storage usage
    
    // Calculate AI requests this month (placeholder)
    const currentAiRequests = 0 // TODO: Calculate from ai_chat_sessions
    
    const limits = plan.limits
    
    return {
      users: {
        current: usersCount || 0,
        limit: limits.users,
        percentage: limits.users === -1 ? 0 : Math.round(((usersCount || 0) / limits.users) * 100)
      },
      deals: {
        current: dealsCount || 0,
        limit: limits.deals,
        percentage: limits.deals === -1 ? 0 : Math.round(((dealsCount || 0) / limits.deals) * 100)
      },
      storage: {
        current_gb: currentStorageGb,
        limit_gb: limits.storage_gb,
        percentage: Math.round((currentStorageGb / limits.storage_gb) * 100)
      },
      ai_requests: {
        current_month: currentAiRequests,
        limit: limits.ai_requests_per_month,
        percentage: limits.ai_requests_per_month === -1 ? 0 : Math.round((currentAiRequests / limits.ai_requests_per_month) * 100)
      }
    }
  }

  /**
   * Change subscription plan -- DISABLED.
   *
   * This used to write company_subscriptions / subscription_history through the
   * per-request USER client, i.e. any company admin could pick their own plan.
   * Plan changes must go through a trusted billing path (payment webhook or a
   * platform-admin service-role route); until that exists this always throws.
   */
  async changePlan(
    _company_id: string,
    _user_id: string,
    _dto: ChangePlanDTO
  ): Promise<CompanySubscription> {
    throw new SubscriptionMutationDisabledError('changePlan')
  }

  /**
   * Get subscription change history
   */
  async getHistory(company_id: string, limit: number = 50): Promise<SubscriptionHistory[]> {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('subscription_history')
      .select('*')
      .eq('company_id', company_id)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (error) {
      throw new Error(`Failed to fetch history: ${error.message}`)
    }
    
    return data as SubscriptionHistory[]
  }

  /**
   * Cancel subscription -- DISABLED (same reason as changePlan: it wrote through
   * the user-scoped client). Always throws.
   */
  async cancelSubscription(
    _company_id: string,
    _user_id: string,
    _reason?: string,
    _immediately: boolean = false
  ): Promise<CompanySubscription> {
    throw new SubscriptionMutationDisabledError('cancelSubscription')
  }

  /**
   * Check if company can perform action based on limits
   */
  async canPerformAction(
    company_id: string,
    action: 'add_user' | 'add_deal' | 'use_ai' | 'upload_file',
    size_mb?: number
  ): Promise<{ allowed: boolean; reason?: string }> {
    const plan = await this.getCurrentPlan(company_id)
    if (!plan) {
      return { allowed: false, reason: 'No active subscription' }
    }
    
    const usage = await this.getUsage(company_id)
    if (!usage) {
      return { allowed: false, reason: 'Unable to check usage' }
    }
    
    const limits = plan.limits
    
    switch (action) {
      case 'add_user':
        if (limits.users === -1) return { allowed: true }
        if (usage.users.current >= limits.users) {
          return { allowed: false, reason: `User limit reached (${limits.users})` }
        }
        return { allowed: true }
      
      case 'add_deal':
        if (limits.deals === -1) return { allowed: true }
        if (usage.deals.current >= limits.deals) {
          return { allowed: false, reason: `Deal limit reached (${limits.deals})` }
        }
        return { allowed: true }
      
      case 'use_ai':
        if (limits.ai_requests_per_month === -1) return { allowed: true }
        if (usage.ai_requests.current_month >= limits.ai_requests_per_month) {
          return { allowed: false, reason: `AI request limit reached (${limits.ai_requests_per_month}/month)` }
        }
        return { allowed: true }
      
      case 'upload_file':
        const newStorageGb = usage.storage.current_gb + (size_mb || 0) / 1024
        if (newStorageGb > limits.storage_gb) {
          return { allowed: false, reason: `Storage limit would be exceeded (${limits.storage_gb} GB)` }
        }
        return { allowed: true }
      
      default:
        return { allowed: true }
    }
  }
}

// Singleton instance (легко заменить на DI в NestJS)
export const subscriptionService = new SubscriptionService()

