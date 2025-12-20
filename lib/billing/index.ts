/**
 * Unified Billing Interface
 * Phase 3: Country-based provider selection
 */

import { TranzilaProvider } from './tranzila'
import { StripeProvider } from './stripe'

export type BillingProvider = 'tranzila' | 'stripe'

/**
 * Get appropriate billing provider based on country
 */
export function getBillingProvider(country: string): {
  provider: BillingProvider
  instance: TranzilaProvider | StripeProvider
} {
  // Israel uses Tranzila for ILS payments
  if (country === 'IL' || country === 'Israel') {
    return {
      provider: 'tranzila',
      instance: new TranzilaProvider(),
    }
  }

  // All other countries use Stripe
  return {
    provider: 'stripe',
    instance: new StripeProvider(),
  }
}

/**
 * Get provider for a company based on their settings
 */
export async function getCompanyBillingProvider(companyId: string): Promise<{
  provider: BillingProvider
  instance: TranzilaProvider | StripeProvider
}> {
  // TODO: Fetch company settings from database
  // For now, default to Stripe
  return {
    provider: 'stripe',
    instance: new StripeProvider(),
  }
}

/**
 * Detect country from request
 */
export function detectCountryFromRequest(req: Request): string {
  // Try to get country from headers (Cloudflare, Vercel, etc.)
  const cfCountry = req.headers.get('cf-ipcountry')
  if (cfCountry) return cfCountry

  const vercelCountry = req.headers.get('x-vercel-ip-country')
  if (vercelCountry) return vercelCountry

  // Default to Israel
  return 'IL'
}

