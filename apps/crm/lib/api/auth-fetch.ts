/**
 * Helper function to make authenticated API calls
 * Automatically adds JWT token from Supabase Auth to headers
 */

import { createClient } from '@/lib/supabase/client'

export async function getAuthHeaders(): Promise<Record<string, string>> {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const supabase = createClient()

    // First try to get current session
    let { data: { session }, error } = await supabase.auth.getSession()

    // If no session, try to refresh
    if (!session || error) {
      console.log('[authFetch] No session, trying to refresh...')
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()

      if (refreshError) {
        console.warn('[authFetch] Failed to refresh session:', refreshError.message)
        return {}
      }

      session = refreshData.session
    }

    if (!session?.access_token) {
      console.warn('[authFetch] No valid session after refresh')
      return {}
    }

    console.log('[authFetch] Got valid session token')
    return {
      Authorization: `Bearer ${session.access_token}`
    }
  } catch (error) {
    console.error('[authFetch] Error getting auth headers:', error)
    return {}
  }
}

/**
 * Make authenticated fetch request to API
 * Automatically adds JWT token from Supabase Auth
 */
export async function authFetch(url: string, options?: RequestInit): Promise<Response> {
  const authHeaders = await getAuthHeaders()
  
  console.log('[authFetch] Calling:', url, 'with auth:', Object.keys(authHeaders).length > 0 ? 'YES' : 'NO')
  
  const headers = {
    ...options?.headers,
    ...authHeaders,
  }

  return fetch(url, {
    ...options,
    headers,
  })
}

