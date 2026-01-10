/**
 * Supabase Client for Server Components and API Routes
 * Uses cookies for session management
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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
            // Cookies are set in API routes and middleware.
          }
        },
      },
    }
  )
}
