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
* 2. Legacy custom JWT token (if still in use)
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
      
      // Get company_id from company_members with company details
      // Priority: 1) Most recently created company where user is owner, 2) Most recent membership
      const { data: members, error: memberError } = await supabase
        .from('company_members')
        .select(`
          company_id, 
          role, 
          joined_at, 
          created_at,
          companies!inner (
            created_at
          )
        `)
        .eq('user_id', user.id)
      
      if (memberError) {
        console.error('[getCompanyIdAsync] company_members query error:', memberError.message)
        return null
      }
      
      if (!members || members.length === 0) {
        console.error('[getCompanyIdAsync] User not in any company')
        return null
      }
      
      console.log('[getCompanyIdAsync] Found', members.length, 'company memberships')
      
      // Filter owner memberships
      const ownerMemberships = members.filter(m => m.role === 'owner')
      
      if (ownerMemberships.length > 0) {
        // Sort by company creation date (most recent first)
        ownerMemberships.sort((a, b) => {
          const dateA = new Date(a.companies.created_at).getTime()
          const dateB = new Date(b.companies.created_at).getTime()
          return dateB - dateA // Descending
        })
        
        const selectedMember = ownerMemberships[0]
        console.log('[getCompanyIdAsync] Selected most recent owner company:', selectedMember.company_id)
        return selectedMember.company_id
      }
      
      // No owner role - take most recent membership
      members.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime()
        const dateB = new Date(b.created_at).getTime()
        return dateB - dateA
      })
      
      const selectedMember = members[0]
      console.log('[getCompanyIdAsync] Selected most recent membership:', selectedMember.company_id, 'role:', selectedMember.role)
      return selectedMember.company_id
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
 * Get full user context from JWT token (synchronous - for middleware)
 * Note: This only works with custom JWT tokens, not Supabase auth tokens
 * For Supabase auth, use getUserContextAsync
 */
export function getUserContext(req: NextRequest): { userId: string; email: string; companyId: string; role: string } | null {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return null
  
  // Try custom JWT token
  const token = authHeader.replace(/^Bearer\s+/i, '')
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
 * Get full user context asynchronously (supports Supabase auth)
 */
export async function getUserContextAsync(req: NextRequest): Promise<{ userId: string; email: string; companyId: string; role: string } | null> {
  if (!supabase) return getUserContext(req)
  
  const authHeader = req.headers.get('authorization')
  
  // Try Supabase Auth JWT
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    
    try {
      // Verify token with Supabase
      const { data: { user }, error } = await supabase.auth.getUser(token)
      
      if (error || !user) {
        return getUserContext(req) // Fallback to sync version
      }
      
      // Get company membership
      const { data: member, error: memberError } = await supabase
        .from('company_members')
        .select('company_id, role')
        .eq('user_id', user.id)
        .single()
      
      if (memberError || !member) {
        return null
      }
      
      return {
        userId: user.id,
        email: user.email || '',
        companyId: member.company_id,
        role: member.role,
      }
    } catch (err: any) {
      console.error('[getUserContextAsync] Error:', err.message)
      return getUserContext(req) // Fallback to sync version
    }
  }
  
  // Fallback to sync version
  return getUserContext(req)
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


