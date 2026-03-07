/**
 * SuperAdmin Authorization Helpers
 * Supports TWO authentication methods:
 * 1. Redis session (primary) - for phone auth login
 * 2. Supabase auth (fallback) - for magic link testing
 */

import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session/redis-client'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

export interface SuperAdminSession {
  user_id: string
  email: string
  role: string
  phone?: string
  auth_method?: 'redis' | 'supabase'
}

/**
 * Check SuperAdmin authentication from request
 * Tries Redis session first, then falls back to Supabase auth
 */
export async function checkSuperAdminAuth(request: NextRequest): Promise<SuperAdminSession | null> {
  // 1️⃣ Try Redis session first (primary method - phone auth)
  const sessionId = request.cookies.get('superadmin_session')?.value
  if (sessionId) {
    try {
      const session = await getSession(sessionId)
      if (session && session.role === 'superadmin') {
        return {
          ...session,
          auth_method: 'redis',
        } as SuperAdminSession
      }
    } catch (error) {
      console.error('[SuperAdmin Auth] Redis session error:', error)
    }
  }

  // 2️⃣ Fallback to Supabase auth (for magic link testing)
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll() {
            // No-op for read-only operations
          },
        },
      }
    )

    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return null
    }

    // Check if user is in platform_admins
    const isAdmin = await isSuperAdmin(user.id)
    
    if (!isAdmin) {
      return null
    }

    return {
      user_id: user.id,
      email: user.email || '',
      role: 'superadmin',
      auth_method: 'supabase',
    }
  } catch (error) {
    console.error('[SuperAdmin Auth] Supabase auth error:', error)
    return null
  }
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

