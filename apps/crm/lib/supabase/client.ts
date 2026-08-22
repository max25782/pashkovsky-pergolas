import { createBrowserClient } from '@supabase/ssr'
import { fetchWithTimeout, DEFAULT_SUPABASE_TIMEOUT_MS } from './fetch-with-timeout'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: fetchWithTimeout(DEFAULT_SUPABASE_TIMEOUT_MS) } }
  )
}
