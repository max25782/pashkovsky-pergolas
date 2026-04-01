import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { requireCompanyAccess } from '@/lib/auth'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase =
  SUPABASE_URL && SERVICE_KEY
    ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
    : undefined

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
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

  const { data, error } = await supabase
    .from('pergola_config_submissions')
    .select('id, config, screenshot, created_at, offer_id')
    .eq('offer_id', offerId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[configurator-submissions]', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  return NextResponse.json({ submissions: data ?? [] })
}
