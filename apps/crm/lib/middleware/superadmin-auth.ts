/**
 * SuperAdmin Authorization Helpers
 * Verify SuperAdmin access for platform management endpoints
 * Uses Supabase SSR auth + platform_admins table
 */

import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
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
  try {
    // Create SSR client to read cookies
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

    // Get authenticated user from Supabase
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      console.log('[SuperAdmin Auth] No user session')
      return null
    }

    // Check if user is in platform_admins
    const isAdmin = await isSuperAdmin(user.id)
    
    if (!isAdmin) {
      console.log('[SuperAdmin Auth] User not in platform_admins:', user.email)
      return null
    }

    return {
      user_id: user.id,
      email: user.email || '',
      role: 'superadmin',
    }
  } catch (error) {
    console.error('[SuperAdmin Auth] Error:', error)
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

