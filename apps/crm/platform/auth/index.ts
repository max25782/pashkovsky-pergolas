/**
 * platform/auth — Authentication & Session
 *
 * Canonical import path for all auth-related utilities.
 * New code should import from '@/platform/auth'.
 */

// Core security layer (getCurrentUser, requireAuth, requireCompanyAccess, verifyResourceOwnership)
export {
  getCurrentUser,
  getCurrentCompanyId,
  requireAuth,
  requireCompanyAccess,
  verifyResourceOwnership,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  // getCompanyId (deprecated sync version) — use @/platform/tenant getCompanyId instead
  type AuthUser,
  type AuthResult,
  type CompanyAccessResult,
} from '@/lib/auth/security'

// JWT utilities
export {
  signToken,
  verifyToken,
  extractToken,
  decodeToken,
  type JWTPayload,
} from '@/lib/auth/jwt'

// Token generation / hashing
export {
  generateToken,
  generateUrlSafeToken,
  hashToken,
  verifyTokenHash,
  getExpirationTime,
  isTokenExpired,
} from '@/lib/auth/tokens'

// Password hashing
export {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
} from '@/lib/auth/password'

// Runtime assertions
export * from '@/lib/auth/runtime-assertions'

// SuperAdmin check (uses service-role Supabase client — for server-only use)
export { isSuperAdmin } from '@/lib/auth/isSuperAdmin'

// Platform admin management (uses server Supabase client)
export {
  isPlatformAdmin,
  getPlatformAdmin,
  hasPlatformPermission,
  verifySuperAdminToken,
  getAllPlatformAdmins,
  // isSuperAdmin from platform-admin.ts is intentionally not re-exported here
  // to avoid name collision — use isSuperAdmin from @/lib/auth/isSuperAdmin
  type PlatformAdmin,
} from '@/lib/auth/platform-admin'

// Supabase JWT middleware (for API routes)
export {
  verifyAuthToken,
  requireAuthAsync,
  type AuthUser as AsyncAuthUser,
  type UserContext,
} from '@/lib/middleware/auth-async'

// Next.js edge middleware session update
export { updateSession } from '@/lib/middleware/auth'

// SuperAdmin middleware
export {
  checkSuperAdminAuth,
  requireSuperAdmin,
  type SuperAdminSession,
} from '@/lib/middleware/superadmin-auth'

// AI Director token verification
export { verifyAIDirectorToken } from '@/lib/middleware/ai-director-auth'

// Redis session (SuperAdmin server-side sessions)
export {
  redis,
  createSession,
  getSession,
  deleteSession,
} from '@/lib/session/redis-client'

// OAuth
export { googleOAuthClient } from '@/lib/auth/oauth/google'

// Note: requireCompanyAuth is exported from @/platform/tenant (its canonical home)
