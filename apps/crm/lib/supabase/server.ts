/**
 * Supabase Client for Server Components and API Routes
 * Uses cookies for session management
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'
import type { CompanyMember } from '@/types/membership'

/**
 * Create Supabase client for Server Components / API Routes
 * Uses cookies for auth session
 */
export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach((cookie) => cookieStore.set(cookie))
          } catch {
            // In Server Components, cookie writes can throw; safe to ignore.
          }
        },
      },
    }
  )
}

/**
 * Get current authenticated user (server-side)
 */
export async function getCurrentUser() {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error) {
    console.error('[Server Auth] Error getting user:', error)
    return null
  }
  
  return user
}

/**
 * Get current user's company ID (server-side)
 */
export async function getUserCompanyId(): Promise<string | null> {
  const user = await getCurrentUser()
  if (!user) return null
  
  const supabase = createClient()
  const { data, error } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .single<Pick<CompanyMember, 'company_id'>>()
  
  if (error) {
    console.error('[Server Auth] Error getting company:', error)
    return null
  }
  
  return data?.company_id || null
}

/**
 * Check if user is authenticated (server-side)
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser()
  return !!user
}

