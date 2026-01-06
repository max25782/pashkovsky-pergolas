/**
 * Supabase Client for Client Components
 * Uses cookies for session storage (Safari-safe)
 */

import { createBrowserClient } from '@supabase/ssr'

/**
 * Create Supabase client for browser
 * Uses cookies (not localStorage) for session - Safari compatible
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Alias for backward compatibility
export const createAuthenticatedClient = createClient

/**
 * Get current authenticated user
 */
export async function getCurrentUser() {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error) {
    console.error('[Auth] Error getting user:', error)
    return null
  }
  
  return user
}

/**
 * Get current user's company ID
 */
export async function getUserCompanyId(): Promise<string | null> {
  const user = await getCurrentUser()
  if (!user) return null
  
  const supabase = createClient()
  const { data, error } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .single()
  
  if (error) {
    console.error('[Auth] Error getting company:', error)
    return null
  }
  
  return data?.company_id || null
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser()
  return !!user
}

