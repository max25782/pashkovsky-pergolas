import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { fetchWithTimeout, DEFAULT_SUPABASE_TIMEOUT_MS } from './fetch-with-timeout'

/**
 * Create Supabase client for Server Components
 * 
 * IMPORTANT: In Server Components, cookies can only be READ, not modified.
 * Token refresh will be handled by the client-side or Route Handlers.
 * This client is read-only and will NOT attempt to refresh tokens.
 */
export function createClient() {
  const store = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return store.getAll()
        },
        setAll(cookiesToSet) {
          // In Server Components, we cannot modify cookies.
          // Token refresh should happen client-side or in Route Handlers.
          // This is a no-op to prevent "Cookies can only be modified in a Server Action or Route Handler" errors.
          // 
          // Note: Supabase will try to refresh tokens automatically when they expire.
          // In Server Components, we silently ignore these attempts.
          // Token refresh will happen on the client-side when the user interacts with the app.
          // 
          // If you see cookie modification errors frequently, consider:
          // 1. Increasing token expiration time in Supabase Dashboard
          // 2. Ensuring client-side components handle token refresh properly
          // 3. Using Route Handlers for operations that require token refresh
        },
      },
      // See fetch-with-timeout.ts — the "GET /api/companies/me 401 in
      // 1084724ms" incident: an unbounded getUser() call can sit on a
      // stalled connection for ~18 minutes before the OS gives up. Every
      // server-side auth.getUser()/getSession() call goes through this
      // factory, so this one line covers all of them.
      global: { fetch: fetchWithTimeout(DEFAULT_SUPABASE_TIMEOUT_MS) },
    }
  )
}
