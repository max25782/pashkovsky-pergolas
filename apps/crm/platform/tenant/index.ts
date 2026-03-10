/**
 * platform/tenant — Multi-Tenant Context
 *
 * Canonical import path for all tenant/company-isolation utilities.
 * New code should import from '@/platform/tenant'.
 */

// Company context extraction (getCompanyId, getUserContext, etc.)
export {
  getCompanyId,
  getCompanyIdAsync,
  getUserId,
  getUserRole,
  getUserContext,
  getUserContextAsync,
  requireCompanyId,
} from '@/lib/middleware/company-context'

// Shared company auth guard (JWT + companyId in one call)
export {
  requireCompanyAuth,
  type CompanyAuthResult,
} from '@/lib/middleware/require-company-auth'

// Integration access check (subscription-gated)
export { checkIntegrationAccess } from '@/lib/middleware/integration-access'

// Rate limiting (per-tenant)
export {
  checkRateLimit,
  rateLimit,
  rateLimiters,
  type RateLimitOptions,
  type RateLimitResult,
} from '@/lib/middleware/rate-limit'
