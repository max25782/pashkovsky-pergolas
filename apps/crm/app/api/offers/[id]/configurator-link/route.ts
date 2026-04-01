import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { requireCompanyAccess } from '@/lib/auth'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase =
  SUPABASE_URL && SERVICE_KEY
    ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
    : undefined

function siteBase(): string {
  const u = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  return u || 'http://localhost:3000'
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuthAsync(req)
  if (!auth.authorized) return auth.error
  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const offerId = params.id
  const { data: row, error: fe } = await supabase.from('offers').select('company_id').eq('id', offerId).single()
  if (fe || !row) {
    return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
  }
  const access = await requireCompanyAccess(req, row.company_id as string)
  if (!access.authorized) return access.error

  let locale = 'he'
  try {
    const body = await req.json()
    if (typeof body?.locale === 'string' && body.locale.length <= 5) locale = body.locale
  } catch {
    /* default locale */
  }

  const token = randomBytes(24).toString('base64url')
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 14)

  const { data: tok, error: insErr } = await supabase
    .from('configurator_link_tokens')
    .insert({
      offer_id: offerId,
      token,
      expires_at: expiresAt.toISOString(),
      locale,
    })
    .select('id')
    .single()

  if (insErr || !tok) {
    console.error('[configurator-link]', insErr)
    return NextResponse.json({ error: 'Failed to create link' }, { status: 500 })
  }

  const base = siteBase()
  const url = `${base}/${locale}/pergola3d?ct=${encodeURIComponent(token)}`
  const customerUrl = `${url}&view=1`

  return NextResponse.json({
    url,
    customerUrl,
    tokenId: tok.id,
    expiresAt: expiresAt.toISOString(),
  })
}
