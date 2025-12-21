// User Roles and Permissions Types

export type UserRole = 'admin' | 'manager' | 'worker' | 'viewer'

export interface RolePermission {
  id: string
  role: UserRole
  resource: string
  action: string
}

export interface CompanyMember {
  id: string
  userId: string
  companyId: string
  role: UserRole
  invitedBy?: string
  invitedAt?: string
  acceptedAt?: string
  createdAt: string
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'מנהל',
  manager: 'מנהל מכירות',
  worker: 'עובד',
  viewer: 'צופה',
}

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: 'גישה מלאה, כולל הגדרות והזמנת משתמשים',
  manager: 'ניהול לידים, עסקאות והצעות מחיר',
  worker: 'רישום משמרות וצפייה בפרויקטים',
  viewer: 'צפייה בלבד',
}

// Permission checking helpers
export type Resource = 
  | 'deals' 
  | 'offers' 
  | 'workers' 
  | 'users' 
  | 'settings'
  | 'reports'
  | 'analytics'

export type Action = 'create' | 'read' | 'update' | 'delete' | 'invite'

export interface PermissionCheck {
  resource: Resource
  action: Action
}

// Quick permission matrix for client-side checks
export const PERMISSIONS: Record<UserRole, Set<string>> = {
  admin: new Set([
    'deals:create', 'deals:read', 'deals:update', 'deals:delete',
    'offers:create', 'offers:read', 'offers:update', 'offers:delete',
    'workers:create', 'workers:read', 'workers:update', 'workers:delete',
    'users:invite', 'users:remove',
    'settings:read', 'settings:update',
    'reports:read',
    'analytics:read',
  ]),
  manager: new Set([
    'deals:create', 'deals:read', 'deals:update', 'deals:delete',
    'offers:create', 'offers:read', 'offers:update', 'offers:delete',
    'workers:read',
    'settings:read',
    'reports:read',
  ]),
  worker: new Set([
    'workers:create', 'workers:read',
    'deals:read',
  ]),
  viewer: new Set([
    'deals:read',
    'offers:read',
    'workers:read',
  ]),
}

export function hasPermission(
  role: UserRole | undefined,
  resource: Resource,
  action: Action
): boolean {
  if (!role) return false
  const key = `${resource}:${action}`
  return PERMISSIONS[role]?.has(key) ?? false
}

export function canManageUsers(role: UserRole | undefined): boolean {
  return role === 'admin'
}

export function canEditSettings(role: UserRole | undefined): boolean {
  return role === 'admin'
}

export function canCreateDeals(role: UserRole | undefined): boolean {
  return hasPermission(role, 'deals', 'create')
}

export function canCreateOffers(role: UserRole | undefined): boolean {
  return hasPermission(role, 'offers', 'create')
}

