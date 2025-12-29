/**
 * Helper function to make authenticated API calls
 * Automatically adds JWT token from localStorage to headers
 */

export function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' 
    ? localStorage.getItem('token') 
    : null

  return token 
    ? { Authorization: `Bearer ${token}` }
    : {}
}

/**
 * Make authenticated fetch request to API
 * Automatically adds JWT token
 */
export async function authFetch(url: string, options?: RequestInit): Promise<Response> {
  const headers = {
    ...options?.headers,
    ...getAuthHeaders(),
  }

  return fetch(url, {
    ...options,
    headers,
  })
}

