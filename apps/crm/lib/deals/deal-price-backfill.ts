/**
 * Old deals: which deals have no amount although they have an offer, and what amount the
 * offer rules would give them. Pure planning step for scripts/backfill-deal-prices.ts.
 */
import {
  pickEffectiveOffer,
  withPriceSource,
  type DealPriceSourceOffer,
  type EffectiveOffer,
  type OfferForPrice,
} from './deal-price-sync'

export interface BackfillDealRow {
  id: string
  company_id: string
  customer_name: string | null
  stage: string | null
  source: string | null
  price: number | string | null
  project_config: unknown
}

export interface BackfillOfferRow extends OfferForPrice {
  deal_id: string | null
}

export interface BackfillPlanRow {
  dealId: string
  companyId: string
  customerName: string | null
  stage: string | null
  offerCount: number
  offerId: string
  offerNumber: string | null
  proposedAmount: number
  approved: boolean
}

export interface BackfillPlan {
  rows: BackfillPlanRow[]
  /** Deals without an amount and without any priced offer: nothing to propose. */
  dealsWithoutOffer: number
  /** Hidden quick-offer deals are not on the board, so they are left out on purpose. */
  skippedHidden: number
}

function hasAmount(price: unknown): boolean {
  const n = Number(price)
  return price !== null && price !== undefined && price !== '' && Number.isFinite(n) && n > 0
}

export function buildBackfillPlan(deals: readonly BackfillDealRow[], offers: readonly BackfillOfferRow[]): BackfillPlan {
  const byDeal = new Map<string, BackfillOfferRow[]>()
  for (const o of offers) {
    if (!o.deal_id) continue
    const list = byDeal.get(o.deal_id) ?? []
    list.push(o)
    byDeal.set(o.deal_id, list)
  }

  const rows: BackfillPlanRow[] = []
  let dealsWithoutOffer = 0
  let skippedHidden = 0

  for (const deal of deals) {
    if (hasAmount(deal.price)) continue
    if (deal.source === 'quick_offer') {
      skippedHidden += 1
      continue
    }
    const dealOffers = byDeal.get(deal.id) ?? []
    const effective: EffectiveOffer | null = pickEffectiveOffer(dealOffers)
    if (!effective) {
      dealsWithoutOffer += 1
      continue
    }
    rows.push({
      dealId: deal.id,
      companyId: deal.company_id,
      customerName: deal.customer_name,
      stage: deal.stage,
      offerCount: dealOffers.length,
      offerId: effective.id,
      offerNumber: effective.offerNumber,
      proposedAmount: effective.amount,
      approved: effective.approved,
    })
  }

  return { rows, dealsWithoutOffer, skippedHidden }
}

/** The deals columns --apply would write for a plan row (price + where it came from). */
export function buildBackfillPatch(
  row: BackfillPlanRow,
  currentProjectConfig: unknown,
  nowIso: string,
): { price: number; project_config: Record<string, unknown> } {
  const source: DealPriceSourceOffer = {
    source: 'offer',
    offerId: row.offerId,
    offerNumber: row.offerNumber,
    amount: row.proposedAmount,
    syncedAt: nowIso,
  }
  return { price: row.proposedAmount, project_config: withPriceSource(currentProjectConfig, source) }
}
