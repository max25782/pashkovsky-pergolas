/**
 * POST /api/quick-offer
 *
 * Creates a hidden deal (source='quick_offer') + offer.
 * The deal is excluded from the CRM board query until the user explicitly saves to CRM
 * via /api/quick-offer/[id]/save-to-crm (which sets source='quick_offer_saved').
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { getCompanyIdAsync } from '@/lib/middleware/company-context'
import type { OfferDraft, Pergola } from '@/types/offer'
import { calculateOffer } from '@/lib/offer-calculator'
import { prepareQuickOfferPergolas } from '@/lib/pergolas/prepare-quick-offer-pergolas'
import { buildQuickOfferInsertRow } from '@/lib/quick-offer/build-quick-offer-row'
import {
  buildQuickOfferExtra,
  hasAnyQuickOfferProduct,
  primaryQuickProduct,
  resolveQuickFencesFromDraft,
  resolveQuickOfferIncludes,
} from '@/lib/quick-offer-includes'
import { validateQuickFence, validateQuickRailings } from '@/lib/quick-offer-product-validation'
import { allocateOfferNumber } from '@/lib/offers/allocate-offer-number'
import { syncDealPriceFromOffers } from '@/lib/deals/deal-price-sync'
import { buildCurrentOfferTermsSnapshot } from '@/lib/offers/offer-terms-snapshot'
import {
  CUSTOMER_NAME_REQUIRED_ERROR,
  isCustomerNameValid,
  normalizeCustomerNameInput,
} from '@/lib/quick-offer/validate-customer-name'

export const runtime = 'nodejs'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase =
  SUPABASE_URL && SERVICE_KEY
    ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
    : undefined

export async function POST(req: NextRequest) {
  const auth = await requireAuthAsync(req)
  if (!auth.authorized) return auth.error

  if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const companyId = await getCompanyIdAsync(req)
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const draft = body as Partial<OfferDraft> & Record<string, unknown>
  const includes = resolveQuickOfferIncludes(draft)
  if (!hasAnyQuickOfferProduct(includes)) {
    return NextResponse.json({ error: 'Select at least one product line' }, { status: 400 })
  }

  const quickProduct = primaryQuickProduct(includes)
  const customerName = normalizeCustomerNameInput(draft.customerName)
  if (!isCustomerNameValid(customerName)) {
    return NextResponse.json({ error: CUSTOMER_NAME_REQUIRED_ERROR }, { status: 400 })
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

  const productCount = [includes.pergola, includes.railings, includes.fence].filter(Boolean).length
  const projectType =
    productCount > 1
      ? null
      : includes.railings
        ? 'railing'
        : includes.fence
          ? 'fence'
          : null
  const workType =
    productCount > 1 ? 'other' : quickProduct

  // ── 1. Deal: bind to an existing one (opened from the deal card) or create a hidden one
  //       (excluded from the CRM board until saved) ───────────────────────────────────
  const requestedDealId = typeof draft.dealId === 'string' ? draft.dealId.trim() : ''
  const boundToExistingDeal = requestedDealId !== ''
  let dealId: string

  if (boundToExistingDeal) {
    const { data: existingDeal, error: existingDealError } = await supabase
      .from('deals')
      .select('id')
      .eq('id', requestedDealId)
      .eq('company_id', companyId)
      .maybeSingle()
    if (existingDealError) {
      console.error('[quick-offer] deal lookup error:', existingDealError)
      return NextResponse.json({ error: 'Failed to load deal' }, { status: 500 })
    }
    if (!existingDeal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    dealId = existingDeal.id as string
  } else {
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .insert({
        company_id: companyId,
        customer_name: customerName,
        customer_phone: '',
        deal_status: 'in_progress',
        work_type: workType,
        project_type: projectType,
        source: 'quick_offer',
        currency: 'ILS',
        // Who made the offer; shown on the board's "unsaved quick offers" tab.
        created_by: auth.user.id,
      })
      .select('id')
      .single()

    if (dealError || !deal) {
      console.error('[quick-offer] deal insert error:', dealError)
      return NextResponse.json({ error: 'Failed to create deal' }, { status: 500 })
    }
    dealId = deal.id as string
  }

  /** Undo everything this request created. A pre-existing deal is never deleted. */
  async function rollbackDeal() {
    if (boundToExistingDeal) return
    await supabase!.from('deals').delete().eq('id', dealId)
  }

  /** New hidden deal: plain inserts. Existing deal: update the row if there is one (legacy behaviour). */
  async function writeProductDetails(): Promise<string | null> {
    if (includes.railings && draft.quickRailings) {
      const qr = draft.quickRailings
      const gsInsert = String(qr.glazingSystem).trim() as 'aluminum_glass' | 'wet_glazing' | 'dry_glazing'
      const payload = {
        deal_id: dealId,
        company_id: companyId!,
        meters_total: Number(qr.metersTotal),
        height_cm: qr.heightCm != null ? Number(qr.heightCm) : null,
        profile_type: String(qr.profileType).trim(),
        color: String(qr.color).trim(),
        location_type: String(qr.locationType).trim() as 'balcony' | 'stairs' | 'roof' | 'yard' | 'other',
        glass_type: qr.glassType != null && String(qr.glassType).trim() !== '' ? String(qr.glassType).trim() : null,
        glazing_system: gsInsert,
        notes: qr.notes != null && String(qr.notes).trim() !== '' ? String(qr.notes).trim() : null,
      }
      const existingRow = boundToExistingDeal
        ? (await supabase!.from('deal_railings_details').select('deal_id').eq('deal_id', dealId).maybeSingle()).data
        : null
      const { error } = existingRow
        ? await supabase!.from('deal_railings_details').update(payload).eq('deal_id', dealId)
        : await supabase!.from('deal_railings_details').insert(payload)
      if (error) {
        console.error('[quick-offer] railings write error:', error)
        return 'Failed to create railings details'
      }
    }

    if (includes.fence) {
      const fences = resolveQuickFencesFromDraft(draft)
      if (fences.length > 0) {
        const qf = fences[0]
        const payload = {
          deal_id: dealId,
          company_id: companyId!,
          meters_total: Number(qf.metersTotal),
          height_cm: qf.heightCm != null ? Number(qf.heightCm) : null,
          fence_variant: String(qf.fenceVariant).trim() as 'classic' | 'hitech' | 'hitech_angular',
          color: String(qf.color).trim(),
          notes: qf.notes != null && String(qf.notes).trim() !== '' ? String(qf.notes).trim() : null,
        }
        const existingRow = boundToExistingDeal
          ? (await supabase!.from('deal_fence_details').select('deal_id').eq('deal_id', dealId).maybeSingle()).data
          : null
        const { error } = existingRow
          ? await supabase!.from('deal_fence_details').update(payload).eq('deal_id', dealId)
          : await supabase!.from('deal_fence_details').insert(payload)
        if (error) {
          console.error('[quick-offer] fence write error:', error)
          return 'Failed to create fence details'
        }
      }
    }
    return null
  }

  if (!boundToExistingDeal) {
    const detailsError = await writeProductDetails()
    if (detailsError) {
      await rollbackDeal()
      return NextResponse.json({ error: detailsError }, { status: 500 })
    }
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
    fenceGateLineTotals: serverCalc.fenceGateLineTotals,
    fenceGateTotal: serverCalc.fenceGateTotal,
  })

  let offerNumber: string
  try {
    offerNumber = await allocateOfferNumber(supabase, companyId)
  } catch (e) {
    console.error('[quick-offer] offer number allocation error:', e)
    await rollbackDeal()
    return NextResponse.json({ error: 'Failed to allocate offer number' }, { status: 500 })
  }

  const insertRow = {
    ...buildQuickOfferInsertRow({
      dealId,
      companyId,
      draft,
      includes,
      normalizedPergolas,
      serverCalc,
      quickOfferExtra,
      customerName,
    }),
    offer_number: offerNumber,
    terms_snapshot: buildCurrentOfferTermsSnapshot(),
  }

  const { data: offer, error: offerError } = await supabase
    .from('offers')
    .insert(insertRow)
    .select('id')
    .single()

  if (offerError || !offer) {
    console.error('[quick-offer] offer insert error:', offerError)
    await rollbackDeal()
    return NextResponse.json({ error: 'Failed to create offer' }, { status: 500 })
  }
  const offerId = offer.id as string

  /** Compensating rollback: Supabase has no multi-statement transaction without a DB function. */
  async function rollbackOffer() {
    const { error } = await supabase!.from('offers').delete().eq('id', offerId)
    if (error) console.error('[quick-offer] offer rollback failed:', offerId, error)
    await rollbackDeal()
  }

  if (boundToExistingDeal) {
    const detailsError = await writeProductDetails()
    if (detailsError) {
      await rollbackOffer()
      return NextResponse.json({ error: detailsError }, { status: 500 })
    }

    // Deal amount = this offer's client total, written in the same request. If it cannot be
    // written the offer is removed again, so there is never an offer without the amount.
    try {
      const dealPrice = await syncDealPriceFromOffers(supabase, { dealId, companyId })
      return NextResponse.json({ offerId, offerNumber, dealId, dealPrice }, { status: 201 })
    } catch (e) {
      console.error('[quick-offer] deal price sync failed, rolling back offer:', offerId, e)
      await rollbackOffer()
      return NextResponse.json({ error: 'Failed to update deal amount' }, { status: 500 })
    }
  }

  return NextResponse.json({ offerId, offerNumber, dealId }, { status: 201 })
}
