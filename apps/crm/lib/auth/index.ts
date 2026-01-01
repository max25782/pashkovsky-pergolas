/**
 * Authentication and Authorization Module
 * 
 * Central security layer for multi-tenant CRM
 */

export {
  getCurrentUser,
  getCurrentCompanyId,
  requireAuth,
  requireCompanyAccess,
  verifyResourceOwnership,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  getCompanyId, // deprecated
  type AuthUser,
  type AuthResult,
  type CompanyAccessResult,
} from './security'

