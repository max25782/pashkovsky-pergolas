/**
 * Deal amount (deals.price) driven by offers.
 *
 * Rules (one place, used by Quick Offer create/update, offer delete, offer approval,
 * configurator sync and the "update from offer" button in the deal card):
 *  1. The amount is the client-visible total (offers.final_price: with VAT, after discount)
 *     of the "effective" offer of the deal.
 *  2. Effective offer = the latest approved (signed) offer; if none is approved,
 *     the latest created offer. A deleted offer no longer exists, so deleting the latest
 *     one moves the amount to the previous offer by the same rule.
 *  3. Where the amount came from lives in deals.project_config.priceSource (jsonb, no
 *     migration needed):  { source: 'offer', offerId, offerNumber, amount } or
 *     { source: 'manual', amount }.
 *  4. A manual amount is never overwritten silently. A price that is not tracked
 *     (no priceSource) or differs from the last synced amount counts as manual; syncing
 *     reports a conflict and writes only with confirm = true.
 *  5. Hidden quick offers (deals.source = 'quick_offer', not yet on the board) are skipped;
 *     the amount is written once the deal reaches the board.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export const PRICE_SOURCE_KEY = 'priceSource'

export interface DealPriceSourceOffer {
  source: 'offer'
  offerId: string
  offerNumber: string | null
  amount: number
  syncedAt: string
}

export interface DealPriceSourceManual {
  source: 'manual'
  amount: number
  editedAt: string
}

export type DealPriceSource = DealPriceSourceOffer | DealPriceSourceManual

export interface OfferForPrice {
  id: string
  offer_number: string | null
  final_price: number | string | null
  approved: boolean | null
  approved_at: string | null
  created_at: string | null
}

export interface EffectiveOffer {
  id: string
  offerNumber: string | null
  amount: number
  approved: boolean
}

export type PriceSyncDecision =
  | { kind: 'noop'; reason: 'no-offer' | 'up-to-date' }
  | { kind: 'write'; offer: EffectiveOffer; amount: number }
  | { kind: 'conflict'; offer: EffectiveOffer; current: number; proposed: number }
  | { kind: 'clear-source' }

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function toMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? roundMoney(n) : null
}

function time(iso: string | null | undefined): number {
  if (!iso) return 0
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : 0
}

/** Accepted offer wins; otherwise the newest. Offers without a numeric price are ignored. */
export function pickEffectiveOffer(offers: readonly OfferForPrice[]): EffectiveOffer | null {
  const priced = offers.filter((o) => toMoney(o.final_price) !== null)
  if (priced.length === 0) return null

  const approved = priced.filter((o) => o.approved === true)
  const pool = approved.length > 0 ? approved : priced
  const stamp = (o: OfferForPrice) =>
    approved.length > 0 ? time(o.approved_at) || time(o.created_at) : time(o.created_at)

  const best = [...pool].sort((a, b) => stamp(b) - stamp(a))[0]
  return {
    id: best.id,
    offerNumber: best.offer_number ?? null,
    amount: toMoney(best.final_price) as number,
    approved: best.approved === true,
  }
}

export function readPriceSource(projectConfig: unknown): DealPriceSource | null {
  if (!projectConfig || typeof projectConfig !== 'object' || Array.isArray(projectConfig)) return null
  const raw = (projectConfig as Record<string, unknown>)[PRICE_SOURCE_KEY]
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const amount = toMoney(r.amount)
  if (amount === null) return null
  if (r.source === 'offer' && typeof r.offerId === 'string') {
    return {
      source: 'offer',
      offerId: r.offerId,
      offerNumber: typeof r.offerNumber === 'string' ? r.offerNumber : null,
      amount,
      syncedAt: typeof r.syncedAt === 'string' ? r.syncedAt : '',
    }
  }
  if (r.source === 'manual') {
    return { source: 'manual', amount, editedAt: typeof r.editedAt === 'string' ? r.editedAt : '' }
  }
  return null
}

/** Returns project_config with priceSource replaced (null removes it); other keys are kept. */
export function withPriceSource(projectConfig: unknown, source: DealPriceSource | null): Record<string, unknown> {
  const base =
    projectConfig && typeof projectConfig === 'object' && !Array.isArray(projectConfig)
      ? { ...(projectConfig as Record<string, unknown>) }
      : {}
  if (source === null) delete base[PRICE_SOURCE_KEY]
  else base[PRICE_SOURCE_KEY] = source
  return base
}

export function decidePriceSync(input: {
  price: unknown
  projectConfig: unknown
  effective: EffectiveOffer | null
  hasAnyOffer: boolean
  confirm?: boolean
}): PriceSyncDecision {
  const { effective, confirm = false } = input
  const meta = readPriceSource(input.projectConfig)

  if (!effective) {
    // The offer the amount came from is gone; keep the amount, drop the dead link.
    if (!input.hasAnyOffer && meta?.source === 'offer') return { kind: 'clear-source' }
    return { kind: 'noop', reason: 'no-offer' }
  }

  const priceNum = toMoney(input.price)
  const current = priceNum !== null && priceNum > 0 ? priceNum : 0

  if (current === effective.amount) {
    const linked = meta?.source === 'offer' && meta.offerId === effective.id && meta.amount === effective.amount
    if (linked) return { kind: 'noop', reason: 'up-to-date' }
    return { kind: 'write', offer: effective, amount: effective.amount }
  }

  if (current === 0) return { kind: 'write', offer: effective, amount: effective.amount }

  // The amount still equals what we wrote last time: nobody touched it, follow the offer.
  if (meta?.source === 'offer' && meta.amount === current) {
    return { kind: 'write', offer: effective, amount: effective.amount }
  }

  if (confirm) return { kind: 'write', offer: effective, amount: effective.amount }
  return { kind: 'conflict', offer: effective, current, proposed: effective.amount }
}

export type DealPriceSyncStatus = 'written' | 'noop' | 'conflict' | 'skipped-hidden' | 'no-deal'

export interface DealPriceSyncResult {
  status: DealPriceSyncStatus
  price: number | null
  source: 'offer' | 'manual' | 'none'
  offerId: string | null
  offerNumber: string | null
  conflict: { current: number; proposed: number; offerId: string; offerNumber: string | null } | null
}

interface DealPriceRow {
  id: string
  source: string | null
  price: number | string | null
  project_config: unknown
}

function describeSource(price: unknown, projectConfig: unknown): Pick<DealPriceSyncResult, 'source' | 'offerId' | 'offerNumber'> {
  const meta = readPriceSource(projectConfig)
  const priceNum = toMoney(price)
  if (priceNum === null || priceNum <= 0) return { source: 'none', offerId: null, offerNumber: null }
  if (meta?.source === 'offer' && meta.amount === priceNum) {
    return { source: 'offer', offerId: meta.offerId, offerNumber: meta.offerNumber }
  }
  return { source: 'manual', offerId: null, offerNumber: null }
}

async function loadDealAndOffers(supabase: SupabaseClient, dealId: string, companyId: string) {
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select('id, source, price, project_config')
    .eq('id', dealId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (dealError) throw new Error(`deal lookup failed: ${dealError.message}`)
  if (!deal) return null

  const { data: offers, error: offersError } = await supabase
    .from('offers')
    .select('id, offer_number, final_price, approved, approved_at, created_at')
    .eq('deal_id', dealId)
    .eq('company_id', companyId)
  if (offersError) throw new Error(`offers lookup failed: ${offersError.message}`)

  return { deal: deal as DealPriceRow, offers: (offers ?? []) as OfferForPrice[] }
}

/** Read-only view for the deal card: current source plus the amount an update would write. */
export async function getDealPriceState(
  supabase: SupabaseClient,
  dealId: string,
  companyId: string,
): Promise<(DealPriceSyncResult & { effective: EffectiveOffer | null }) | null> {
  const loaded = await loadDealAndOffers(supabase, dealId, companyId)
  if (!loaded) return null
  const { deal, offers } = loaded
  const effective = pickEffectiveOffer(offers)
  const decision = decidePriceSync({
    price: deal.price,
    projectConfig: deal.project_config,
    effective,
    hasAnyOffer: offers.length > 0,
  })
  const src = describeSource(deal.price, deal.project_config)
  return {
    status: decision.kind === 'conflict' ? 'conflict' : 'noop',
    price: toMoney(deal.price),
    ...src,
    conflict:
      decision.kind === 'conflict'
        ? {
            current: decision.current,
            proposed: decision.proposed,
            offerId: decision.offer.id,
            offerNumber: decision.offer.offerNumber,
          }
        : null,
    effective,
  }
}

/**
 * Recomputes deals.price from the deal's offers and writes it (price + priceSource in one
 * UPDATE). Throws on database errors so callers inside a create flow can roll back.
 */
export async function syncDealPriceFromOffers(
  supabase: SupabaseClient,
  params: { dealId: string; companyId: string; confirm?: boolean },
): Promise<DealPriceSyncResult> {
  const { dealId, companyId, confirm = false } = params
  const loaded = await loadDealAndOffers(supabase, dealId, companyId)
  if (!loaded) {
    return { status: 'no-deal', price: null, source: 'none', offerId: null, offerNumber: null, conflict: null }
  }
  const { deal, offers } = loaded

  if (deal.source === 'quick_offer') {
    return {
      status: 'skipped-hidden',
      price: toMoney(deal.price),
      ...describeSource(deal.price, deal.project_config),
      conflict: null,
    }
  }

  const effective = pickEffectiveOffer(offers)
  const decision = decidePriceSync({
    price: deal.price,
    projectConfig: deal.project_config,
    effective,
    hasAnyOffer: offers.length > 0,
    confirm,
  })

  if (decision.kind === 'noop') {
    return {
      status: 'noop',
      price: toMoney(deal.price),
      ...describeSource(deal.price, deal.project_config),
      conflict: null,
    }
  }

  if (decision.kind === 'conflict') {
    return {
      status: 'conflict',
      price: decision.current,
      source: 'manual',
      offerId: null,
      offerNumber: null,
      conflict: {
        current: decision.current,
        proposed: decision.proposed,
        offerId: decision.offer.id,
        offerNumber: decision.offer.offerNumber,
      },
    }
  }

  const nowIso = new Date().toISOString()
  const patch: Record<string, unknown> =
    decision.kind === 'clear-source'
      ? { project_config: withPriceSource(deal.project_config, null) }
      : {
          price: decision.amount,
          project_config: withPriceSource(deal.project_config, {
            source: 'offer',
            offerId: decision.offer.id,
            offerNumber: decision.offer.offerNumber,
            amount: decision.amount,
            syncedAt: nowIso,
          }),
        }

  const { data: updated, error } = await supabase
    .from('deals')
    .update(patch)
    .eq('id', dealId)
    .eq('company_id', companyId)
    .select('id, price, project_config')
  if (error) throw new Error(`deal price update failed: ${error.message}`)
  if (!updated || updated.length === 0) throw new Error('deal price update failed: no rows updated')

  const row = updated[0] as { price: number | string | null; project_config: unknown }
  return {
    status: 'written',
    price: toMoney(row.price),
    ...describeSource(row.price, row.project_config),
    conflict: null,
  }
}

/**
 * Best-effort wrapper for flows where the main write already succeeded (delete, approve,
 * configurator save): a failed sync is logged with context and never fails the request.
 */
export async function trySyncDealPrice(
  supabase: SupabaseClient,
  params: { dealId: string | null | undefined; companyId: string; context: string },
): Promise<DealPriceSyncResult | null> {
  if (!params.dealId) return null
  try {
    return await syncDealPriceFromOffers(supabase, { dealId: params.dealId, companyId: params.companyId })
  } catch (e) {
    console.error(`[deal-price-sync] ${params.context} failed for deal ${params.dealId}:`, e)
    return null
  }
}

/** Marks a hand-typed amount (used by the deals PATCH route). */
export function manualPriceSource(amount: number, nowIso: string): DealPriceSourceManual {
  return { source: 'manual', amount: roundMoney(amount), editedAt: nowIso }
}
