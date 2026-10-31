import { buildBackfillPatch, buildBackfillPlan, type BackfillDealRow, type BackfillOfferRow } from '../deal-price-backfill'
import { readPriceSource } from '../deal-price-sync'

function deal(overrides: Partial<BackfillDealRow> & { id: string }): BackfillDealRow {
  return {
    company_id: 'c1',
    customer_name: 'לקוח',
    stage: 'offer',
    source: 'quick_offer_saved',
    price: null,
    project_config: null,
    ...overrides,
  }
}

function offer(overrides: Partial<BackfillOfferRow> & { id: string; deal_id: string }): BackfillOfferRow {
  return {
    offer_number: null,
    final_price: 1000,
    approved: false,
    approved_at: null,
    created_at: '2026-10-01T10:00:00.000Z',
    ...overrides,
  }
}

describe('buildBackfillPlan', () => {
  it('proposes the latest offer for a deal without an amount', () => {
    const plan = buildBackfillPlan(
      [deal({ id: 'd1' })],
      [
        offer({ id: 'a', deal_id: 'd1', offer_number: '2026-0010', final_price: 30000 }),
        offer({ id: 'b', deal_id: 'd1', offer_number: '2026-0014', final_price: 45000, created_at: '2026-10-05T10:00:00.000Z' }),
      ],
    )
    expect(plan.rows).toEqual([
      expect.objectContaining({ dealId: 'd1', offerNumber: '2026-0014', proposedAmount: 45000, offerCount: 2, approved: false }),
    ])
  })

  it('prefers the signed offer', () => {
    const plan = buildBackfillPlan(
      [deal({ id: 'd1' })],
      [
        offer({ id: 'a', deal_id: 'd1', offer_number: '2026-0010', final_price: 30000, approved: true, approved_at: '2026-10-02T10:00:00.000Z' }),
        offer({ id: 'b', deal_id: 'd1', offer_number: '2026-0014', final_price: 45000, created_at: '2026-10-05T10:00:00.000Z' }),
      ],
    )
    expect(plan.rows[0]).toMatchObject({ offerNumber: '2026-0010', proposedAmount: 30000, approved: true })
  })

  it('leaves deals that already have an amount, have no offer, or are hidden quick offers', () => {
    const plan = buildBackfillPlan(
      [
        deal({ id: 'has-price', price: 5000 }),
        deal({ id: 'no-offer' }),
        deal({ id: 'hidden', source: 'quick_offer' }),
        deal({ id: 'zero', price: 0 }),
      ],
      [
        offer({ id: 'o1', deal_id: 'has-price' }),
        offer({ id: 'o2', deal_id: 'hidden' }),
        offer({ id: 'o3', deal_id: 'zero', offer_number: '2026-0001', final_price: 777 }),
      ],
    )
    expect(plan.rows.map((r) => r.dealId)).toEqual(['zero'])
    expect(plan.dealsWithoutOffer).toBe(1)
    expect(plan.skippedHidden).toBe(1)
  })
})

describe('buildBackfillPatch', () => {
  it('writes the amount with the offer as its source and keeps other config keys', () => {
    const plan = buildBackfillPlan(
      [deal({ id: 'd1', project_config: { product_lines: ['pergola'] } })],
      [offer({ id: 'a', deal_id: 'd1', offer_number: '2026-0014', final_price: 41300 })],
    )
    const patch = buildBackfillPatch(plan.rows[0], { product_lines: ['pergola'] }, '2026-10-31T00:00:00.000Z')
    expect(patch.price).toBe(41300)
    expect(readPriceSource(patch.project_config)).toMatchObject({ source: 'offer', offerId: 'a', offerNumber: '2026-0014' })
    expect(patch.project_config.product_lines).toEqual(['pergola'])
  })
})
