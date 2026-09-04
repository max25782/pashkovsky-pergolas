/**
 * API Authorization Middleware
 * Checks if user has required permissions for API endpoints
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserContext, getUserContextAsync } from '@/lib/middleware/company-context'
import { can, Permission, Role } from '@/lib/permissions'

/**
 * Check if user has required permission
 * Returns error response if not authorized
 */
export function requirePermission(req: NextRequest, permission: Permission): { authorized: boolean; error?: NextResponse } {
  // Check user context from JWT token
  const userContext = getUserContext(req)
  
  if (!userContext) {
    return {
      authorized: false,
      error: NextResponse.json(
        { error: 'Unauthorized: No valid token' },
        { status: 401 }
      )
    }
  }
  
  const hasPermission = can(userContext.role as Role, permission)
  
  if (!hasPermission) {
    return {
      authorized: false,
      error: NextResponse.json(
        { error: `Forbidden: ${permission} permission required` },
        { status: 403 }
      )
    }
  }
  
  return { authorized: true }
}

/**
 * Check if user has any of the required permissions
 */
export function requireAnyPermission(req: NextRequest, permissions: Permission[]): { authorized: boolean; error?: NextResponse } {
  const userContext = getUserContext(req)
  
  if (!userContext) {
    return {
      authorized: false,
      error: NextResponse.json(
        { error: 'Unauthorized: No valid token' },
        { status: 401 }
      )
    }
  }
  
  const hasAnyPermission = permissions.some(permission => 
    can(userContext.role as Role, permission)
  )
  
  if (!hasAnyPermission) {
    return {
      authorized: false,
      error: NextResponse.json(
        { error: `Forbidden: One of [${permissions.join(', ')}] permissions required` },
        { status: 403 }
      )
    }
  }
  
  return { authorized: true }
}

/**
 * Check if user has required role(s)
 */
export function requireRole(req: NextRequest, role: Role | Role[]): { authorized: boolean; error?: NextResponse } {
  const userContext = getUserContext(req)
  
  if (!userContext) {
    return {
      authorized: false,
      error: NextResponse.json(
        { error: 'Unauthorized: No valid token' },
        { status: 401 }
      )
    }
  }
  
  const roles = Array.isArray(role) ? role : [role]
  const hasRole = roles.includes(userContext.role as Role)
  
  if (!hasRole) {
    return {
      authorized: false,
      error: NextResponse.json(
        { error: `Forbidden: ${roles.join(' or ')} role required` },
        { status: 403 }
      )
    }
  }
  
  return { authorized: true }
}

/**
 * Check if request is authenticated (has valid JWT token)
 */
export function requireAuth(req: NextRequest): { authorized: boolean; error?: NextResponse } {
  // Check for JWT token
  const userContext = getUserContext(req)
  if (userContext) {
    return { authorized: true }
  }
  
  return {
    authorized: false,
    error: NextResponse.json(
      { error: 'Unauthorized: No valid token' },
      { status: 401 }
    )
  }
}

/**
 * Async permission check — works with Supabase Auth tokens (loads role from company_members).
 */
export async function requirePermissionAsync(
  req: NextRequest,
  permission: Permission,
): Promise<{ authorized: boolean; error?: NextResponse; role?: Role; companyId?: string }> {
  const userContext = await getUserContextAsync(req)

  if (!userContext) {
    return {
      authorized: false,
      error: NextResponse.json(
        { error: 'Unauthorized: No valid token' },
        { status: 401 },
      ),
    }
  }

  const role = userContext.role as Role
  if (!can(role, permission)) {
    return {
      authorized: false,
      error: NextResponse.json(
        { error: `Forbidden: ${permission} permission required` },
        { status: 403 },
      ),
    }
  }

  return { authorized: true, role, companyId: userContext.companyId }
}
