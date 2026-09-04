/**
 * Permissions System
 * Phase 2: Role-based access control
 */

export type Role = 'owner' | 'admin' | 'manager' | 'viewer' | 'salesperson'

export type Permission =
  // Deals
  | 'deals:view'
  | 'deals:create'
  | 'deals:edit'
  | 'deals:delete'
  // Leads
  | 'leads:view'
  | 'leads:create'
  | 'leads:edit'
  | 'leads:delete'
  // Offers
  | 'offers:view'
  | 'offers:create'
  | 'offers:edit'
  | 'offers:delete'
  // Financial
  | 'finance:view'
  | 'finance:edit'
  // Users
  | 'users:view'
  | 'users:invite'
  | 'users:remove'
  | 'users:edit_roles'
  // Billing
  | 'billing:view'
  | 'billing:manage'
  // Settings
  | 'settings:view'
  | 'settings:edit'
  // Workers
  | 'workers:view'
  | 'workers:create'
  | 'workers:edit'
  | 'workers:delete'
  // Reports
  | 'reports:view'
  | 'reports:export'

/**
 * Permission matrix for each role
 */
export const PERMISSIONS: Record<Permission, Role[]> = {
  // Deals
  'deals:view': ['owner', 'admin', 'manager', 'viewer'],
  'deals:create': ['owner', 'admin', 'manager'],
  'deals:edit': ['owner', 'admin', 'manager'],
  'deals:delete': ['owner', 'admin'],
  
  // Leads
  'leads:view': ['owner', 'admin', 'manager', 'viewer', 'salesperson'],
  'leads:create': ['owner', 'admin', 'manager', 'salesperson'],
  'leads:edit': ['owner', 'admin', 'manager', 'salesperson'],
  'leads:delete': ['owner', 'admin'],
  
  // Offers
  'offers:view': ['owner', 'admin', 'manager', 'viewer', 'salesperson'],
  'offers:create': ['owner', 'admin', 'manager', 'salesperson'],
  'offers:edit': ['owner', 'admin', 'manager', 'salesperson'],
  'offers:delete': ['owner', 'admin'],
  
  // Financial
  'finance:view': ['owner', 'admin'],
  'finance:edit': ['owner', 'admin'],
  
  // Users
  'users:view': ['owner', 'admin'],
  'users:invite': ['owner', 'admin'],
  'users:remove': ['owner', 'admin'],
  'users:edit_roles': ['owner'],
  
  // Billing
  'billing:view': ['owner'],
  'billing:manage': ['owner'],
  
  // Settings
  'settings:view': ['owner', 'admin'],
  'settings:edit': ['owner'],
  
  // Workers
  'workers:view': ['owner', 'admin', 'manager'],
  'workers:create': ['owner', 'admin'],
  'workers:edit': ['owner', 'admin'],
  'workers:delete': ['owner', 'admin'],
  
  // Reports
  'reports:view': ['owner', 'admin', 'manager'],
  'reports:export': ['owner', 'admin'],
}

/**
 * Check if a role has a specific permission
 */
export function can(role: Role, permission: Permission): boolean {
  const allowedRoles = PERMISSIONS[permission]
  return allowedRoles?.includes(role) ?? false
}

/**
 * Check if a role has any of the specified permissions
 */
export function canAny(role: Role, permissions: Permission[]): boolean {
  return permissions.some(permission => can(role, permission))
}

/**
 * Check if a role has all of the specified permissions
 */
export function canAll(role: Role, permissions: Permission[]): boolean {
  return permissions.every(permission => can(role, permission))
}

/**
 * Get all permissions for a role
 */
export function getPermissions(role: Role): Permission[] {
  return Object.keys(PERMISSIONS).filter(permission => 
    can(role, permission as Permission)
  ) as Permission[]
}

/**
 * Role hierarchy (for inheritance)
 */
export const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 4,
  admin: 3,
  manager: 2,
  viewer: 1,
  salesperson: 1,
}

/**
 * Check if roleA has higher or equal rank than roleB
 */
export function hasHigherOrEqualRank(roleA: Role, roleB: Role): boolean {
  return ROLE_HIERARCHY[roleA] >= ROLE_HIERARCHY[roleB]
}

/**
 * Validate role string
 */
export function isValidRole(role: string): role is Role {
  return ['owner', 'admin', 'manager', 'viewer', 'salesperson'].includes(role)
}

/** Nav paths a role may open (subscription plan gating is applied separately). */
export function canAccessNavPath(role: Role, path: string): boolean {
  if (role === 'salesperson') {
    return (
      path === '/app/admin' ||
      path.startsWith('/app/admin/leads') ||
      path.startsWith('/app/quick-offer')
    )
  }
  if (path.startsWith('/app/admin/users')) {
    return can(role, 'users:view')
  }
  if (path.startsWith('/app/admin/settings')) {
    return can(role, 'settings:view')
  }
  return true
}



