/**
 * Async API Authorization Helper
 * Verifies Supabase Auth JWT tokens for API routes
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY)
  : null

export interface AuthUser {
  id: string
  email: string
}

export interface UserContext {
  userId: string
  email: string
  companyId?: string
}

/**
 * Verify Supabase Auth JWT token from request
 * Returns user if valid, null otherwise
 */
export async function verifyAuthToken(req: NextRequest): Promise<AuthUser | null> {
  if (!supabase) {
    console.error('[verifyAuthToken] Supabase not configured')
    return null
  }
  
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    console.warn('[verifyAuthToken] No Bearer token in Authorization header')
    return null
  }
  
  const token = authHeader.substring(7)
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error) {
      console.warn('[verifyAuthToken] Token verification failed:', error.message)
      return null
    }
    
    if (!user) {
      console.warn('[verifyAuthToken] No user found for token')
      return null
    }
    
    return {
      id: user.id,
      email: user.email || '',
    }
  } catch (error) {
    console.error('[verifyAuthToken] Exception:', error)
    return null
  }
}

/**
 * Get user context including company_id from company_members table
 */
async function getUserContext(userId: string, email: string): Promise<UserContext> {
  if (!supabase) {
    return { userId, email }
  }

  try {
    // Get company_id from company_members table
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', userId)
      .single()

    return {
      userId,
      email,
      companyId: membership?.company_id,
    }
  } catch (error) {
    console.warn('[getUserContext] Failed to fetch company membership:', error)
    return { userId, email }
  }
}

/**
 * Require authentication for API route
 * Returns user context if authorized, or error response if not
 */
export async function requireAuthAsync(req: NextRequest): Promise<
  { authorized: true; user: AuthUser; context: UserContext } | { authorized: false; error: NextResponse }
> {
  const user = await verifyAuthToken(req)
  
  if (!user) {
    return {
      authorized: false,
      error: NextResponse.json(
        { error: 'Unauthorized: Invalid or missing authentication token' },
        { status: 401 }
      ),
    }
  }
  
  // Get full user context including company_id
  const context = await getUserContext(user.id, user.email)
  
  return { authorized: true, user, context }
}

