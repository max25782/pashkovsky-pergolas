/**
 * Feature Flags & Limits Checker
 * Phase 3: Check if company can use specific features
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

export interface CompanyLimits {
  max_users: number | null
  max_deals: number | null
  max_storage_gb: number | null
}

export interface CompanyFeatures {
  ai: boolean
  teams: boolean
  signatures: boolean
  custom_reports: boolean
  white_label: boolean
  api_access: boolean
  priority_support: boolean
  [key: string]: boolean
}

/**
 * Check if company can use a specific feature
 */
export async function can_use_feature(
  companyId: string,
  feature: keyof CompanyFeatures
): Promise<boolean> {
  if (!supabase) {
    console.error('Supabase not configured')
    return false
  }

  try {
    // Get company with plan details
    const { data: company, error } = await supabase
      .from('companies')
      .select(`
        *,
        subscription:subscriptions(
          *,
          plan:plans(*)
        )
      `)
      .eq('id', companyId)
      .single()

    if (error || !company) {
      console.error('Failed to fetch company:', error)
      return false
    }

    // If no active subscription, check trial
    if (!company.subscription || company.subscription.length === 0) {
      // Check if trial is still valid
      if (company.trial_ends_at) {
        const trialEndsAt = new Date(company.trial_ends_at)
        if (trialEndsAt > new Date()) {
          // Trial period - limited features
          return feature === 'signatures' // Only signatures during trial
        }
      }
      return false
    }

    const subscription = Array.isArray(company.subscription) 
      ? company.subscription[0] 
      : company.subscription

    // Check subscription status
    if (subscription.status !== 'active' && subscription.status !== 'trialing') {
      return false
    }

    // Get plan features
    const plan = Array.isArray(subscription.plan)
      ? subscription.plan[0]
      : subscription.plan
    
    if (!plan || !plan.features) {
      return false
    }

    return plan.features[feature] === true
  } catch (error) {
    console.error('Error checking feature:', error)
    return false
  }
}

/**
 * Get company limits
 */
export async function get_company_limits(
  companyId: string
): Promise<CompanyLimits> {
  const defaults: CompanyLimits = {
    max_users: 2,
    max_deals: 10,
    max_storage_gb: 1,
  }

  if (!supabase) {
    return defaults
  }

  try {
    const { data: company } = await supabase
      .from('companies')
      .select(`
        subscription:subscriptions(
          plan:plans(*)
        )
      `)
      .eq('id', companyId)
      .single()

    if (!company?.subscription) {
      return defaults
    }

    const subscription = Array.isArray(company.subscription) 
      ? company.subscription[0] 
      : company.subscription

    const plan = Array.isArray(subscription?.plan)
      ? subscription.plan[0]
      : subscription?.plan

    return {
      max_users: plan?.max_users ?? defaults.max_users,
      max_deals: plan?.max_deals ?? defaults.max_deals,
      max_storage_gb: plan?.max_storage_gb ?? defaults.max_storage_gb,
    }
  } catch (error) {
    console.error('Error getting limits:', error)
    return defaults
  }
}

/**
 * Check if company has reached limit
 */
export async function has_reached_limit(
  companyId: string,
  limitType: 'users' | 'deals' | 'storage'
): Promise<boolean> {
  if (!supabase) {
    return false
  }

  try {
    const limits = await get_company_limits(companyId)

    switch (limitType) {
      case 'users': {
        if (limits.max_users === null) return false // Unlimited
        const { count } = await supabase
          .from('company_members')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('status', 'active')
        return (count ?? 0) >= limits.max_users
      }

      case 'deals': {
        if (limits.max_deals === null) return false // Unlimited
        const { count } = await supabase
          .from('deals')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
        return (count ?? 0) >= limits.max_deals
      }

      case 'storage': {
        if (limits.max_storage_gb === null) return false // Unlimited
        // TODO: Implement storage calculation
        return false
      }

      default:
        return false
    }
  } catch (error) {
    console.error('Error checking limit:', error)
    return false
  }
}

/**
 * Get all features for a company
 */
export async function get_company_features(
  companyId: string
): Promise<CompanyFeatures> {
  const defaults: CompanyFeatures = {
    ai: false,
    teams: false,
    signatures: true,
    custom_reports: false,
    white_label: false,
    api_access: false,
    priority_support: false,
  }

  if (!supabase) {
    return defaults
  }

  try {
    const { data: company } = await supabase
      .from('companies')
      .select(`
        subscription:subscriptions(
          plan:plans(features)
        )
      `)
      .eq('id', companyId)
      .single()

    if (!company?.subscription) {
      return defaults
    }

    const subscription = Array.isArray(company.subscription) 
      ? company.subscription[0] 
      : company.subscription

    const plan = Array.isArray(subscription?.plan)
      ? subscription.plan[0]
      : subscription?.plan

    const features = plan?.features

    return features ? { ...defaults, ...features } : defaults
  } catch (error) {
    console.error('Error getting features:', error)
    return defaults
  }
}

