import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTazrimContext, type TazrimContext } from '@/lib/tazrim/guard'

export type TazrimApiAuth =
  | { ok: true; ctx: TazrimContext }
  | { ok: false; response: NextResponse }

/**
 * Anonymous callers get 401. A signed-in user without Tazrim access gets 403.
 * company id comes only from getTazrimContext (the membership row), never from
 * the query string or the body.
 */
export async function resolveTazrimApi(): Promise<TazrimApiAuth> {
  const supabase = createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const ctx = await getTazrimContext()
  if (!ctx) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { ok: true, ctx }
}
