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
   * Change subscription plan
   */
  async changePlan(
    company_id: string,
    user_id: string,
    dto: ChangePlanDTO
  ): Promise<CompanySubscription> {
    const supabase = createClient()
    
    // Get new plan
    const newPlan = await this.getPlanByKey(dto.new_plan_key)
    if (!newPlan) {
      throw new Error(`Plan not found: ${dto.new_plan_key}`)
    }
    
    // Get current subscription
    const currentSubscription = await this.getCurrentSubscription(company_id)
    if (!currentSubscription) {
      throw new Error('No active subscription found')
    }
    
    // Update subscription
    const updateData = {
      plan_id: newPlan.id,
      billing_cycle: dto.billing_cycle || currentSubscription.billing_cycle,
      updated_at: new Date().toISOString()
    }
    
    const { data, error } = await (supabase
      .from('company_subscriptions') as any)
      .update(updateData)
      .eq('company_id', company_id)
      .select()
      .single()
    
    if (error) {
      throw new Error(`Failed to update subscription: ${error.message}`)
    }
    
    // Log to history
    await (supabase
      .from('subscription_history') as any)
      .insert({
        company_id,
        old_plan_id: currentSubscription.plan_id,
        new_plan_id: newPlan.id,
        changed_by: user_id,
        change_reason: dto.reason
      })
    
    return data as CompanySubscription
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
   * Cancel subscription
   */
  async cancelSubscription(
    company_id: string,
    user_id: string,
    reason?: string,
    immediately: boolean = false
  ): Promise<CompanySubscription> {
    const supabase = createClient()
    
    const currentSubscription = await this.getCurrentSubscription(company_id)
    if (!currentSubscription) {
      throw new Error('No active subscription found')
    }
    
    const updateData: Partial<CompanySubscription> = {
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      auto_renew: false
    }
    
    if (immediately) {
      updateData.current_period_end = new Date().toISOString()
    }
    
    const { data, error } = await (supabase
      .from('company_subscriptions') as any)
      .update(updateData)
      .eq('company_id', company_id)
      .select()
      .single()
    
    if (error) {
      throw new Error(`Failed to cancel subscription: ${error.message}`)
    }
    
    // Log to history
    await (supabase
      .from('subscription_history') as any)
      .insert({
        company_id,
        old_plan_id: currentSubscription.plan_id,
        new_plan_id: currentSubscription.plan_id,
        changed_by: user_id,
        change_reason: `Canceled: ${reason || 'No reason provided'}`
      })
    
    return data as CompanySubscription
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

