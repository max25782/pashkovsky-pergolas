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
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error || !session?.access_token) {
      console.warn('[authFetch] No valid session:', error?.message || 'No access_token')
      return {}
    }

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
  
  const headers = {
    ...options?.headers,
    ...authHeaders,
  }

  return fetch(url, {
    ...options,
    headers,
  })
}

