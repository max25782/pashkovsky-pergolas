/**
 * Centralized Security Layer for Multi-Tenant CRM
 * 
 * This module provides a unified authentication and authorization system
 * that MUST be used in all CRM API routes and server components.
 * 
 * Usage:
 * ```typescript
 * import { requireAuth, requireCompanyAccess } from '@/lib/auth/security'
 * 
 * export async function GET(req: NextRequest) {
 *   const auth = await requireAuth(req)
 *   if (!auth.authorized) return auth.error
 *   
 *   // Fetch resource
 *   const resource = await getResource(id)
 *   
 *   // Verify company access
 *   const access = await requireCompanyAccess(req, resource.company_id)
 *   if (!access.authorized) return access.error
 *   
 *   return NextResponse.json(resource)
 * }
 * ```
 */

import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

// ============================================================
// Types
// ============================================================

export interface AuthUser {
  userId: string
  email?: string
  companyId: string | null
  role?: string
}

export type AuthResult = {
  authorized: true
  user: AuthUser
} | {
  authorized: false
  error: NextResponse
}

export type CompanyAccessResult = {
  authorized: true
} | {
  authorized: false
  error: NextResponse
}

// ============================================================
// Core Functions
// ============================================================

/**
 * Get current user from request (JWT or admin token)
 * Does NOT throw errors - returns null if no valid auth found
 */
export async function getCurrentUser(req: NextRequest): Promise<AuthUser | null> {
  try {
    // Try JWT token first
    const jwtUser = await getUserFromJWT(req)
    if (jwtUser) return jwtUser

    // Fallback to admin token (legacy)
    const adminUser = await getUserFromAdminToken(req)
    if (adminUser) return adminUser

    return null
  } catch (error) {
    console.error('[Security] Error getting current user:', error)
    return null
  }
}

/**
 * Get current company ID from request
 * Returns null if no valid auth or no company selected
 */
export async function getCurrentCompanyId(req: NextRequest): Promise<string | null> {
  const user = await getCurrentUser(req)
  return user?.companyId || null
}

/**
 * Require authentication - returns error response if not authenticated
 * 
 * @example
 * const auth = await requireAuth(req)
 * if (!auth.authorized) return auth.error
 * 
 * // Now you can safely use auth.user
 * const userId = auth.user.userId
 */
export async function requireAuth(req: NextRequest): Promise<AuthResult> {
  const user = await getCurrentUser(req)

  if (!user) {
    return {
      authorized: false,
      error: NextResponse.json(
        { error: 'Unauthorized: No valid authentication token' },
        { status: 401 }
      ),
    }
  }

  if (!user.companyId) {
    return {
      authorized: false,
      error: NextResponse.json(
        { error: 'Unauthorized: No company selected' },
        { status: 401 }
      ),
    }
  }

  return {
    authorized: true,
    user,
  }
}

/**
 * Require company access - verifies that resource belongs to user's company
 * 
 * @param req - The request object
 * @param resourceCompanyId - The company_id of the resource being accessed
 * 
 * @example
 * const deal = await getDeal(dealId)
 * const access = await requireCompanyAccess(req, deal.company_id)
 * if (!access.authorized) return access.error
 */
export async function requireCompanyAccess(
  req: NextRequest,
  resourceCompanyId: string | null | undefined
): Promise<CompanyAccessResult> {
  const user = await getCurrentUser(req)

  if (!user || !user.companyId) {
    return {
      authorized: false,
      error: NextResponse.json(
        { error: 'Unauthorized: No company context' },
        { status: 401 }
      ),
    }
  }

  if (!resourceCompanyId) {
    return {
      authorized: false,
      error: NextResponse.json(
        { error: 'Forbidden: Resource has no company ownership' },
        { status: 403 }
      ),
    }
  }

  if (user.companyId !== resourceCompanyId) {
    console.warn('[Security] Company access denied', {
      userId: user.userId,
      userCompanyId: user.companyId,
      resourceCompanyId,
    })

    return {
      authorized: false,
      error: NextResponse.json(
        { error: 'Forbidden: Access denied to this resource' },
        { status: 403 }
      ),
    }
  }

  return { authorized: true }
}

/**
 * Verify resource ownership - checks if a resource belongs to user's company
 * Fetches the resource from database and verifies company_id
 * 
 * @param req - The request object
 * @param tableName - The table name (e.g., 'deals', 'offers')
 * @param resourceId - The ID of the resource
 * 
 * @example
 * const ownership = await verifyResourceOwnership(req, 'offers', offerId)
 * if (!ownership.authorized) return ownership.error
 */
export async function verifyResourceOwnership(
  req: NextRequest,
  tableName: string,
  resourceId: string
): Promise<CompanyAccessResult> {
  if (!supabase) {
    return {
      authorized: false,
      error: NextResponse.json(
        { error: 'Server not configured' },
        { status: 500 }
      ),
    }
  }

  const user = await getCurrentUser(req)

  if (!user || !user.companyId) {
    return {
      authorized: false,
      error: NextResponse.json(
        { error: 'Unauthorized: No company context' },
        { status: 401 }
      ),
    }
  }

  // Fetch resource to check company_id
  const { data, error } = await supabase
    .from(tableName)
    .select('company_id')
    .eq('id', resourceId)
    .single()

  if (error || !data) {
    console.error(`[Security] Resource not found: ${tableName}/${resourceId}`, error)
    return {
      authorized: false,
      error: NextResponse.json(
        { error: 'Resource not found' },
        { status: 404 }
      ),
    }
  }

  if (data.company_id !== user.companyId) {
    console.warn('[Security] Resource ownership denied', {
      userId: user.userId,
      userCompanyId: user.companyId,
      resourceCompanyId: data.company_id,
      table: tableName,
      resourceId,
    })

    return {
      authorized: false,
      error: NextResponse.json(
        { error: 'Forbidden: Access denied to this resource' },
        { status: 403 }
      ),
    }
  }

  return { authorized: true }
}

// ============================================================
// Helper Functions (Internal)
// ============================================================

/**
 * Get user from JWT token (modern auth)
 */
async function getUserFromJWT(req: NextRequest): Promise<AuthUser | null> {
  try {
    // Try cookie first
    const tokenFromCookie = req.cookies.get('token')?.value

    // Try Authorization header
    const authHeader = req.headers.get('authorization')
    const tokenFromHeader = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null

    const token = tokenFromCookie || tokenFromHeader

    if (!token) return null

    // Verify JWT
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || 'your-secret-key'
    )
    const { payload } = await jwtVerify(token, secret)

    // Extract user data
    const userId = (payload.sub || payload.user_id) as string
    const companyId = payload.company_id as string | null
    const email = payload.email as string | undefined
    const role = payload.role as string | undefined

    if (!userId) return null

    return {
      userId,
      email,
      companyId,
      role,
    }
  } catch (error) {
    // JWT verification failed - not an error, just no valid JWT
    return null
  }
}

/**
 * Get user from admin token (legacy auth)
 */
async function getUserFromAdminToken(req: NextRequest): Promise<AuthUser | null> {
  try {
    const adminToken = req.headers.get('x-admin-token')

    if (!adminToken) return null

    const expectedToken = process.env.ADMIN_TOKEN

    if (!expectedToken || adminToken !== expectedToken) {
      return null
    }

    // Admin token is valid but has no specific user/company
    // We'll mark this as 'admin' user with special company ID
    return {
      userId: 'admin-token-user',
      companyId: 'admin', // Special marker - some routes may need to handle this
      role: 'admin',
    }
  } catch (error) {
    return null
  }
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Create error response for unauthorized access
 */
export function unauthorizedResponse(message?: string): NextResponse {
  return NextResponse.json(
    { error: message || 'Unauthorized' },
    { status: 401 }
  )
}

/**
 * Create error response for forbidden access
 */
export function forbiddenResponse(message?: string): NextResponse {
  return NextResponse.json(
    { error: message || 'Forbidden: Access denied' },
    { status: 403 }
  )
}

/**
 * Create error response for not found
 */
export function notFoundResponse(message?: string): NextResponse {
  return NextResponse.json(
    { error: message || 'Resource not found' },
    { status: 404 }
  )
}

// ============================================================
// Backward Compatibility (for existing code)
// ============================================================

/**
 * @deprecated Use requireAuth() instead
 */
export function getCompanyId(req: NextRequest): string | null {
  // This is a synchronous version for backward compatibility
  // For new code, use await getCurrentCompanyId(req)
  const companyId = req.headers.get('x-company-id')
  return companyId || null
}

