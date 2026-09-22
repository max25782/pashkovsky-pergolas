/**
 * PATCH /api/quick-offer/[id] — update offer totals and pergolas_data (re-submit from result screen).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { getCompanyIdAsync } from '@/lib/middleware/company-context'
import type { OfferDraft, Pergola } from '@/types/offer'
import { calculateOffer } from '@/lib/offer-calculator'
import {
  buildQuickOfferExtra,
  hasAnyQuickOfferProduct,
  resolveQuickOfferIncludes,
  resolveQuickFencesFromDraft,
} from '@/lib/quick-offer-includes'
import { validateQuickFence, validateQuickRailings } from '@/lib/quick-offer-product-validation'
import { prepareQuickOfferPergolas } from '@/lib/pergolas/prepare-quick-offer-pergolas'
import { buildQuickOfferInsertRow } from '@/lib/quick-offer/build-quick-offer-row'

export const runtime = 'nodejs'

function getServiceSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return undefined
  return createClient(url, key, { db: { schema: 'public' } })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuthAsync(req)
  if (!auth.authorized) return auth.error

  const supabase = getServiceSupabase()
  if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const companyId = await getCompanyIdAsync(req)
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const offerId = params.id

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { data: existing, error: fetchErr } = await supabase
    .from('offers')
    .select('id, deal_id, company_id, customer_name')
    .eq('id', offerId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
  }

  const draft = body as Partial<OfferDraft> & Record<string, unknown>
  const includes = resolveQuickOfferIncludes(draft)
  if (!hasAnyQuickOfferProduct(includes)) {
    return NextResponse.json({ error: 'Select at least one product line' }, { status: 400 })
  }

  if (includes.railings) {
    const err = validateQuickRailings(draft)
    if (err) return NextResponse.json({ error: err }, { status: 400 })
  }
  if (includes.fence) {
    const err = validateQuickFence(draft)
    if (err) return NextResponse.json({ error: err }, { status: 400 })
  }

  let normalizedPergolas: Pergola[] = []
  if (includes.pergola) {
    const prepared = prepareQuickOfferPergolas(draft)
    if (!prepared.ok) {
      return NextResponse.json({ error: prepared.error }, { status: 400 })
    }
    normalizedPergolas = prepared.pergolas
  }

  const calcDraft = {
    ...(draft as OfferDraft),
    pergolas: normalizedPergolas,
    includePergola: includes.pergola,
    includeRailings: includes.railings,
    includeFence: includes.fence,
    quickFences: includes.fence ? resolveQuickFencesFromDraft(draft) : undefined,
  }
  const serverCalc = calculateOffer(calcDraft)

  const quickOfferExtra = buildQuickOfferExtra(calcDraft, {
    railingsLineTotal: serverCalc.railingsLineTotal,
    fenceLineTotal: serverCalc.fenceLineTotal,
    fenceLineTotals: serverCalc.fenceLineTotals,
  })

  const updateRow = buildQuickOfferInsertRow({
    dealId: String(existing.deal_id),
    companyId,
    draft,
    includes,
    normalizedPergolas,
    serverCalc,
    quickOfferExtra,
    customerName: String(existing.customer_name ?? 'הצעה מהירה'),
  })

  const { error: updateErr } = await supabase.from('offers').update(updateRow).eq('id', offerId)

  if (updateErr) {
    console.error('[quick-offer PATCH] update error:', updateErr)
    return NextResponse.json({ error: 'Failed to update offer' }, { status: 500 })
  }

  return NextResponse.json({ offerId, area: serverCalc.area })
}
