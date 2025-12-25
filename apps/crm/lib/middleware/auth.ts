/**
 * API Authorization Middleware
 * Checks if user has required permissions for API endpoints
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserContext } from '@/lib/middleware/company-context'
import { can, Permission, Role } from '@/lib/permissions'

/**
 * Check if user has required permission
 * Returns error response if not authorized
 */
export function requirePermission(req: NextRequest, permission: Permission): { authorized: boolean; error?: NextResponse } {
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
 * Check if user has specific role
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
 * Check if request is authenticated (has valid token)
 * Returns admin token as fallback for backward compatibility
 */
export function requireAuth(req: NextRequest): { authorized: boolean; error?: NextResponse; isAdmin?: boolean } {
  // Check for JWT token first
  const userContext = getUserContext(req)
  if (userContext) {
    return { authorized: true }
  }
  
  // Fallback to admin token (for backward compatibility)
  const adminToken = req.headers.get('x-admin-token') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const expectedAdminToken = process.env.ADMIN_TOKEN
  
  if (adminToken && expectedAdminToken && adminToken === expectedAdminToken) {
    return { authorized: true, isAdmin: true }
  }
  
  return {
    authorized: false,
    error: NextResponse.json(
      { error: 'Unauthorized: No valid token' },
      { status: 401 }
    )
  }
}



