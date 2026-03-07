import { createClient } from '@/lib/supabase/client'

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
  return fetch(url, {
    ...options,
    headers: { ...options?.headers, ...authHeaders },
  })
}

