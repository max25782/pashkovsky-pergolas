import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * Same logic as the marketing site prefill route: read token from Supabase.
 * No HTTP hop to :3000 — avoids CORS and works if only the CRM is running.
 */
export async function GET(req: NextRequest) {
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }

  const ct = req.nextUrl.searchParams.get('ct')?.trim()
  if (!ct) {
    return NextResponse.json({ error: 'Missing ct' }, { status: 400 })
  }

  const supabase = createClient(url, serviceKey, { db: { schema: 'public' } })
  const { data: tok, error } = await supabase
    .from('configurator_link_tokens')
    .select('expires_at, revoked_at, prefill_config, locale')
    .eq('token', ct)
    .maybeSingle()

  if (error !== null || tok === null || tok === undefined) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  }
  if (tok.revoked_at) {
    return NextResponse.json({ error: 'Revoked' }, { status: 403 })
  }
  const exp = new Date(tok.expires_at as string).getTime()
  if (Number.isFinite(exp) && exp < Date.now()) {
    return NextResponse.json({ error: 'Expired' }, { status: 403 })
  }

  return NextResponse.json({
    prefill: tok.prefill_config ?? null,
    locale: (tok.locale as string) || 'he',
  })
}
