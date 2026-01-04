/**
 * SuperAdmin Authorization Helpers
 * Verify SuperAdmin access for platform management endpoints
 * Uses Redis session with superadmin_session cookie
 */

import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session/redis-client'
import { createClient } from '@supabase/supabase-js'

export interface SuperAdminSession {
  user_id: string
  email: string
  role: string
  phone?: string
}

/**
 * Check SuperAdmin authentication from request
 * Returns session if authenticated, null otherwise
 */
export async function checkSuperAdminAuth(request: NextRequest): Promise<SuperAdminSession | null> {
  const sessionId = request.cookies.get('superadmin_session')?.value
  if (!sessionId) return null
  
  const session = await getSession(sessionId)
  if (!session || session.role !== 'superadmin') return null
  
  return session as SuperAdminSession
}

/**
 * Require SuperAdmin authentication
 * Throws error if not authenticated or not SuperAdmin
 */
export async function requireSuperAdmin(request: NextRequest): Promise<SuperAdminSession> {
  const session = await checkSuperAdminAuth(request)
  
  if (!session) {
    throw new Error('Unauthorized: Authentication required')
  }
  
  return session
}

/**
 * Check if user is SuperAdmin (non-throwing, for use in server components)
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const { data: admin, error } = await supabase
      .from('platform_admins')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    return !error && !!admin
  } catch {
    return false
  }
}

