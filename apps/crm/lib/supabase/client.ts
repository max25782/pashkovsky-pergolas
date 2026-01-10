/**
 * Supabase Client for Client Components
 * Uses cookie-based session storage (Safari-safe, SSR-compatible)
 */

import { createBrowserClient } from '@supabase/ssr'

/**
 * Create Supabase browser client
 * - Uses cookies (NOT localStorage)
 * - Syncs with server-side session
 * - Safari/Incognito compatible
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
