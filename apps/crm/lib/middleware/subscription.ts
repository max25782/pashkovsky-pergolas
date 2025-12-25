import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCompanyId } from './company-context'
import type { PlanLimitCheck } from '@/types/subscription'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

/**
 * Check if company has reached a plan limit
 */
export async function checkPlanLimit(
  companyId: string,
  limitType: 'users' | 'deals' | 'storage'
): Promise<PlanLimitCheck | null> {
  if (!supabase) return null

  const { data, error } = await supabase
    .rpc('check_plan_limit', {
      p_company_id: companyId,
      p_limit_type: limitType
    })

  if (error) {
    console.error('Plan limit check error:', error)
    return null
  }

  return data as PlanLimitCheck
}

/**
 * Check if company has access to a feature
 */
export async function checkFeatureAccess(
  companyId: string,
  feature: string
): Promise<boolean> {
  if (!supabase) return false

  const { data, error } = await supabase
    .rpc('has_feature', {
      p_company_id: companyId,
      p_feature: feature
    })

  if (error) {
    console.error('Feature check error:', error)
    return false
  }

  return data === true
}

/**
 * Increment usage counter
 */
export async function incrementUsage(
  companyId: string,
  counter: 'deals' | 'offers' | 'pdfs' | 'whatsapp' | 'emails',
  amount: number = 1
): Promise<void> {
  if (!supabase) return

  const { error } = await supabase
    .rpc('increment_usage', {
      p_company_id: companyId,
      p_counter: counter,
      p_amount: amount
    })

  if (error) {
    console.error('Usage increment error:', error)
  }
}

/**
 * Middleware: Check plan limit before action
 */
export function requirePlanLimit(
  limitType: 'users' | 'deals' | 'storage'
) {
  return async function(req: NextRequest): Promise<{ allowed: boolean; error?: NextResponse; limit?: PlanLimitCheck }> {
    const companyId = getCompanyId(req)
    
    if (!companyId) {
      return {
        allowed: false,
        error: NextResponse.json(
          { error: 'No company context' },
          { status: 401 }
        )
      }
    }

    const limitCheck = await checkPlanLimit(companyId, limitType)

    if (!limitCheck) {
      // If check fails, allow by default (don't block on errors)
      return { allowed: true }
    }

    if (!limitCheck.allowed) {
      const limitText = limitCheck.limit === null ? 'unlimited' : limitCheck.limit
      return {
        allowed: false,
        limit: limitCheck,
        error: NextResponse.json(
          { 
            error: `Plan limit reached`,
            details: `Your ${limitCheck.plan} plan allows ${limitText} ${limitType}. Current: ${limitCheck.current}`,
            upgrade: true
          },
          { status: 403 }
        )
      }
    }

    return { allowed: true, limit: limitCheck }
  }
}

/**
 * Middleware: Require feature access
 */
export function requireFeature(feature: string) {
  return async function(req: NextRequest): Promise<{ allowed: boolean; error?: NextResponse }> {
    const companyId = getCompanyId(req)
    
    if (!companyId) {
      return {
        allowed: false,
        error: NextResponse.json(
          { error: 'No company context' },
          { status: 401 }
        )
      }
    }

    const hasAccess = await checkFeatureAccess(companyId, feature)

    if (!hasAccess) {
      return {
        allowed: false,
        error: NextResponse.json(
          { 
            error: `Feature not available`,
            details: `The '${feature}' feature is not available on your current plan`,
            upgrade: true
          },
          { status: 403 }
        )
      }
    }

    return { allowed: true }
  }
}

/**
 * Get company's current subscription
 */
export async function getCompanySubscription(companyId: string) {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('company_subscriptions')
    .select(`
      *,
      plan:subscription_plans(*)
    `)
    .eq('company_id', companyId)
    .eq('status', 'active')
    .single()

  if (error || !data) return null
  return data
}

/**
 * Get company's usage for current month
 */
export async function getCompanyUsage(companyId: string) {
  if (!supabase) return null

  const periodStart = new Date()
  periodStart.setDate(1)
  periodStart.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('company_usage')
    .select('*')
    .eq('company_id', companyId)
    .gte('period_start', periodStart.toISOString())
    .single()

  if (error || !data) return null
  return data
}

