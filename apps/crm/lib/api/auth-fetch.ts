import { createClient } from '@/lib/supabase/client'
import { fetchWithTimeout, DEFAULT_SUPABASE_TIMEOUT_MS } from '@/lib/supabase/fetch-with-timeout'

const boundedFetch = fetchWithTimeout(DEFAULT_SUPABASE_TIMEOUT_MS)

export async function getAuthHeaders(): Promise<Record<string, string>> {
  if (typeof window === 'undefined') return {}

  try {
    const supabase = createClient()
    let { data: { session }, error } = await supabase.auth.getSession()

    if (!session || error !== null) {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError !== null) return {}
      session = refreshData.session
    }

    if (!session?.access_token) return {}

    return { Authorization: `Bearer ${session.access_token}` }
  } catch {
    return {}
  }
}

export async function authFetch(url: string, options?: RequestInit): Promise<Response> {
  const authHeaders = await getAuthHeaders()
  // Bounded (see fetch-with-timeout.ts) — this wrapper is the browser→API
  // hop used by useCompanyName/useLeads/useDeals/CRMSidebar and others; an
  // unbounded network hiccup on THIS leg would hang a UI request the same
  // way the unbounded getUser() call hung the server side.
  return boundedFetch(url, {
    ...options,
    headers: { ...options?.headers, ...authHeaders },
  })
}

