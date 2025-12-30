/**
 * Company Context Middleware
 * Extracts company_id from JWT token or admin token
 */

import { NextRequest } from 'next/server'
import { verifyToken, extractToken } from '@/lib/auth/jwt'
import { createClient } from '@supabase/supabase-js'

const PASHKOVSKY_COMPANY_ID = '00000000-0000-0000-0000-000000000001'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null

/**
* Get company ID from request (synchronous version - returns cached value)
* Priority:
* 1. JWT token (from Authorization header) - verify with Supabase
* 2. Admin token (legacy support)
*/
export function getCompanyId(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization')
  
  // Try custom JWT token first (legacy)
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
  
  // NOTE: Supabase Auth JWT validation must be done async - use getCompanyIdAsync
  return null
}

/**
 * Get company ID asynchronously from Supabase Auth JWT
 * This is the recommended method for API routes
 */
export async function getCompanyIdAsync(req: NextRequest): Promise<string | null> {
  if (!supabase) return null
  
  const authHeader = req.headers.get('authorization')
  
  // Try Supabase Auth JWT
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    
    try {
      // Verify token with Supabase
      const { data: { user }, error } = await supabase.auth.getUser(token)
      
      if (error || !user) {
        console.log('[getCompanyIdAsync] Supabase auth error:', error?.message || 'No user')
        return getCompanyId(req) // Fallback to sync version
      }
      
      console.log('[getCompanyIdAsync] User found:', user.id, user.email)
      
      // Get company_id from company_members
      const { data: member, error: memberError } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', user.id)
        .single()
      
      if (memberError) {
        console.error('[getCompanyIdAsync] company_members query error:', memberError.message)
        return null
      }
      
      if (!member) {
        console.error('[getCompanyIdAsync] User not in any company')
        return null
      }
      
      console.log('[getCompanyIdAsync] Company found:', member.company_id)
      return member.company_id
    } catch (err: any) {
      console.error('[getCompanyIdAsync] Error:', err.message)
      return getCompanyId(req) // Fallback to sync version
    }
  }
  
  // Fallback to sync version (for admin tokens, etc.)
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


