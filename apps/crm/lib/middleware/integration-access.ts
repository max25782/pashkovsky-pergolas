/**
 * Integration Access Middleware
 * Check if company can use website integrations
 */

import crypto from 'crypto'
import { subscriptionService } from '@/lib/services/subscription-service'
import { createClient } from '@supabase/supabase-js'

/**
 * Check if company has access to integrations (paid plans only)
 */
export async function checkIntegrationAccess(companyId: string): Promise<boolean> {
  try {
    const plan = await subscriptionService.getCurrentPlan(companyId)
    if (!plan) return false
    
    // Trial plan cannot use integrations
    if (plan.plan_key === 'trial') return false
    
    const subscription = await subscriptionService.getCurrentSubscription(companyId)
    if (!subscription) return false
    
    // Check subscription is active
    if (subscription.status !== 'active' && subscription.status !== 'trialing') {
      return false
    }
    
    return true
  } catch (error) {
    console.error('[Integration Access] Error checking access:', error)
    return false
  }
}

/**
 * Verify HMAC-SHA256 signature for webhook
 */
export function verifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const hmac = crypto.createHmac('sha256', secret)
    const computed = hmac.update(payload, 'utf8').digest('hex')
    
    // Timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(computed)
    )
  } catch (error) {
    console.error('[Integration] Signature verification error:', error)
    return false
  }
}

/**
 * Normalize Israeli phone number
 * Converts +972XXXXXXXXX to 0XXXXXXXXX
 */
export function normalizePhoneIL(phone: string): string {
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '')
  
  // If starts with 972, replace with 0
  if (digits.startsWith('972')) {
    digits = '0' + digits.slice(3)
  }
  
  return digits
}

/**
 * Get company by webhook secret
 */
export async function getCompanyByWebhookSecret(
  secret: string
): Promise<string | null> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const { data, error } = await supabase
      .from('company_integrations')
      .select('company_id')
      .eq('webhook_secret', secret)
      .single()

    if (error || !data) {
      return null
    }

    return data.company_id
  } catch (error) {
    console.error('[Integration] Error fetching company by secret:', error)
    return null
  }
}




