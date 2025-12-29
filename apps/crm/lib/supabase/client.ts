/**
 * Supabase Client with Auth for Client Components
 * Uses Supabase Auth for proper RLS and multi-tenancy
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Singleton instance
let supabaseInstance: SupabaseClient | null = null

/**
 * Create or return existing Supabase client for browser
 * Uses Supabase Auth for RLS - session managed automatically
 */
export function createClient() {
  if (supabaseInstance) {
    return supabaseInstance
  }
  
  console.log('[Supabase Client] Creating NEW client with Supabase Auth')
  
  supabaseInstance = createSupabaseClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    }
  )
  
  return supabaseInstance
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

