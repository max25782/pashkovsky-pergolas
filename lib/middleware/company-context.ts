/**
 * Company Context Middleware
 * Extracts company_id from JWT token or admin token
 */

import { NextRequest } from 'next/server'
import { verifyToken, extractToken } from '@/lib/auth/jwt'

const PASHKOVSKY_COMPANY_ID = '00000000-0000-0000-0000-000000000001'

/**
 * Get company ID from request
 * Priority:
 * 1. JWT token (from Authorization header)
 * 2. Admin token (legacy support)
 */
export function getCompanyId(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization')
  
  // Try JWT token first
  if (authHeader) {
    const token = extractToken(authHeader)
    if (token) {
      const payload = verifyToken(token)
      if (payload && payload.companyId) {
        return payload.companyId
      }
    }
  }
  
  // Fallback to admin token (for backward compatibility)
  const adminToken = req.headers.get('x-admin-token') || authHeader?.replace(/^Bearer\s+/i, '')
  const expectedAdminToken = process.env.ADMIN_TOKEN
  
  if (adminToken && expectedAdminToken && adminToken === expectedAdminToken) {
    // Admin token - return Pashkovsky company ID
    return PASHKOVSKY_COMPANY_ID
  }
  
  return null
}

/**
 * Get company ID asynchronously (for future use)
 * Currently just returns the sync version
 */
export async function getCompanyIdAsync(req: NextRequest): Promise<string | null> {
  return getCompanyId(req)
}

/**
 * Get user ID from JWT token
 */
export function getUserId(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return null
  
  const token = extractToken(authHeader)
  if (!token) return null
  
  const payload = verifyToken(token)
  return payload?.userId || null
}

/**
 * Get user role from JWT token
 */
export function getUserRole(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return null
  
  const token = extractToken(authHeader)
  if (!token) return null
  
  const payload = verifyToken(token)
  return payload?.role || null
}

/**
 * Get full user context from JWT token
 */
export function getUserContext(req: NextRequest): { userId: string; email: string; companyId: string; role: string } | null {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return null
  
  const token = extractToken(authHeader)
  if (!token) return null
  
  const payload = verifyToken(token)
  if (!payload || !payload.userId || !payload.companyId) return null
  
  return {
    userId: payload.userId,
    email: payload.email,
    companyId: payload.companyId,
    role: payload.role,
  }
}

/**
 * Middleware to ensure company_id is present
 */
export function requireCompanyId(req: NextRequest): string {
  const companyId = getCompanyId(req)
  
  if (!companyId) {
    throw new Error('Unauthorized: No company context')
  }
  
  return companyId
}


