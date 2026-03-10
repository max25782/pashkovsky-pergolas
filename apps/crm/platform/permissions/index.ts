/**
 * platform/permissions — RBAC Permission Service
 *
 * Canonical import path for all permission/role utilities.
 * New code should import from '@/platform/permissions'.
 *
 * Usage:
 *   import { can, Permission, Role } from '@/platform/permissions'
 *   if (!can(userRole, 'deals:edit')) return forbiddenResponse()
 */

// Core permission system (Role, Permission, PERMISSIONS matrix, can/canAny/canAll)
export {
  can,
  canAny,
  canAll,
  getPermissions,
  hasHigherOrEqualRank,
  isValidRole,
  PERMISSIONS,
  ROLE_HIERARCHY,
  type Role,
  type Permission,
} from '@/lib/permissions/index'

// Legacy role types (from types/roles.ts — used in existing components)
export {
  type UserRole,
  type RolePermission,
  type CompanyMember,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  hasPermission,
  canManageUsers,
  canEditSettings,
  canCreateDeals,
  canCreateOffers,
} from '@/types/roles'

// Async permission check middleware (fetches role from DB)
export {
  getUserRole as getUserRoleFromDB,
  checkPermission,
  requirePermission,
} from '@/lib/middleware/permissions'
