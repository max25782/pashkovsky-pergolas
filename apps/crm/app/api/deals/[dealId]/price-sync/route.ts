/**
 * Deal amount vs. offers.
 *
 * GET  /api/deals/[dealId]/price-sync  -> where the amount came from + what an update would write
 * POST /api/deals/[dealId]/price-sync  -> { confirm: true } overwrites a manual amount with the
 *                                         effective offer's total (the "update from offer" button)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { getCompanyIdAsync } from '@/lib/middleware/company-context'
import { getDealPriceState, syncDealPriceFromOffers } from '@/lib/deals/deal-price-sync'

export const runtime = 'nodejs'

type RouteParams = { dealId: string }

function getServiceSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return undefined
  return createClient(url, key, { db: { schema: 'public' } })
}

export async function GET(req: NextRequest, context: { params: RouteParams | Promise<RouteParams> }) {
  const auth = await requireAuthAsync(req)
  if (!auth.authorized) return auth.error

  const supabase = getServiceSupabase()
  if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const companyId = await getCompanyIdAsync(req)
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { dealId } = await Promise.resolve(context.params)
  try {
    const state = await getDealPriceState(supabase, dealId, companyId)
    if (!state) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    return NextResponse.json(state)
  } catch (e) {
    console.error('[deal price-sync GET] failed:', dealId, e)
    return NextResponse.json({ error: 'Failed to load deal amount' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, context: { params: RouteParams | Promise<RouteParams> }) {
  const auth = await requireAuthAsync(req)
  if (!auth.authorized) return auth.error

  const supabase = getServiceSupabase()
  if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const companyId = await getCompanyIdAsync(req)
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { dealId } = await Promise.resolve(context.params)

  let body: { confirm?: unknown } = {}
  try {
    body = (await req.json()) as { confirm?: unknown }
  } catch {
    body = {}
  }

  try {
    const result = await syncDealPriceFromOffers(supabase, {
      dealId,
      companyId,
      confirm: body.confirm === true,
    })
    if (result.status === 'no-deal') return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    return NextResponse.json(result)
  } catch (e) {
    console.error('[deal price-sync POST] failed:', dealId, e)
    return NextResponse.json({ error: 'Failed to update deal amount' }, { status: 500 })
  }
}
