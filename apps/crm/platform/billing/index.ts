/**
 * platform/billing — Subscription, Plans & Billing
 *
 * Canonical import path for all billing/subscription utilities.
 * New code should import from '@/platform/billing'.
 */

// Billing provider selection (Tranzila for IL, Stripe for rest)
export {
  getBillingProvider,
  type BillingProvider,
} from '@/lib/billing/index'

// Stripe provider
export { StripeProvider } from '@/lib/billing/stripe'

// Tranzila provider
export { TranzilaProvider } from '@/lib/billing/tranzila'

// Subscription service (plan management, usage, history)
export { subscriptionService, SubscriptionService } from '@/lib/services/subscription-service'

// Feature flags & limits checker
export {
  can_use_feature,
  get_company_limits,
  has_reached_limit,
  get_company_features,
  type CompanyLimits,
  type CompanyFeatures,
} from '@/lib/features/check'

// Subscription middleware (plan limit checks for API routes)
export {
  checkPlanLimit,
  checkFeatureAccess,
  incrementUsage,
  requirePlanLimit,
  requireFeature,
  getCompanySubscription,
  getCompanyUsage,
} from '@/lib/middleware/subscription'

// AI Director subscription gate
export { checkAIDirectorAccess } from '@/lib/middleware/ai-director-subscription'
