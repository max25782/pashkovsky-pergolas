import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { TazrimContext } from '@/lib/tazrim/guard'

/**
 * Writes to supplier-invoice tables go through the service role, and only
 * after resolveTazrimApi / requireTazrimActionContext has checked the session
 * and the owner/admin role. The key is never logged. Tests pass `ctx.db`
 * so they never construct this client.
 */
export function createTazrimServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function invoiceDb(ctx: TazrimContext & { db?: SupabaseClient }): SupabaseClient {
  if (ctx.db) return ctx.db
  return createTazrimServiceClient()
}
