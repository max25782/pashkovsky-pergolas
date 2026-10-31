import type { SupabaseClient } from '@supabase/supabase-js'
import {
  decidePriceSync,
  getDealPriceState,
  manualPriceSource,
  pickEffectiveOffer,
  readPriceSource,
  syncDealPriceFromOffers,
  trySyncDealPrice,
  withPriceSource,
  type OfferForPrice,
} from '../deal-price-sync'
import { createFakeSupabase, type Db } from './fake-supabase'

const COMPANY = 'company-1'
const DEAL = 'deal-1'

function offer(overrides: Partial<OfferForPrice> & { id: string }): OfferForPrice & Record<string, unknown> {
  return {
    offer_number: null,
    final_price: 1000,
    approved: false,
    approved_at: null,
    created_at: '2026-10-01T10:00:00.000Z',
    deal_id: DEAL,
    company_id: COMPANY,
    ...overrides,
  }
}

function setup(opts: {
  deal?: Record<string, unknown>
  offers?: Array<OfferForPrice & Record<string, unknown>>
}) {
  const db: Db = {
    deals: [
      { id: DEAL, company_id: COMPANY, source: 'quick_offer_saved', price: null, project_config: null, ...opts.deal },
    ],
    offers: opts.offers ?? [],
  }
  const supabase = createFakeSupabase(db) as unknown as SupabaseClient
  return { db, supabase }
}

const dealRow = (db: Db) => db.deals[0] as { price: number | null; project_config: Record<string, unknown> | null }

describe('pickEffectiveOffer', () => {
  it('takes the latest offer when none is approved', () => {
    const picked = pickEffectiveOffer([
      offer({ id: 'a', final_price: 100, created_at: '2026-10-01T10:00:00.000Z' }),
      offer({ id: 'b', final_price: 200, created_at: '2026-10-03T10:00:00.000Z' }),
      offer({ id: 'c', final_price: 150, created_at: '2026-10-02T10:00:00.000Z' }),
    ])
    expect(picked).toMatchObject({ id: 'b', amount: 200, approved: false })
  })

  it('gives an approved offer priority over a newer one', () => {
    const picked = pickEffectiveOffer([
      offer({ id: 'signed', final_price: 100, approved: true, approved_at: '2026-10-02T10:00:00.000Z' }),
      offer({ id: 'newer', final_price: 999, created_at: '2026-10-09T10:00:00.000Z' }),
    ])
    expect(picked).toMatchObject({ id: 'signed', amount: 100, approved: true })
  })

  it('takes the latest approval when several are approved', () => {
    const picked = pickEffectiveOffer([
      offer({ id: 'first', final_price: 100, approved: true, approved_at: '2026-10-02T10:00:00.000Z' }),
      offer({ id: 'second', final_price: 120, approved: true, approved_at: '2026-10-05T10:00:00.000Z' }),
    ])
    expect(picked?.id).toBe('second')
  })

  it('ignores offers without a numeric price and returns null for none', () => {
    expect(pickEffectiveOffer([])).toBeNull()
    expect(pickEffectiveOffer([offer({ id: 'x', final_price: null })])).toBeNull()
  })
})

describe('syncDealPriceFromOffers', () => {
  it('writes the offer total (client price with VAT) and its source into an empty deal', async () => {
    const { db, supabase } = setup({ offers: [offer({ id: 'o1', offer_number: '2026-0014', final_price: 41300 })] })
    const result = await syncDealPriceFromOffers(supabase, { dealId: DEAL, companyId: COMPANY })

    expect(result.status).toBe('written')
    expect(dealRow(db).price).toBe(41300)
    expect(readPriceSource(dealRow(db).project_config)).toMatchObject({
      source: 'offer',
      offerId: 'o1',
      offerNumber: '2026-0014',
      amount: 41300,
    })
    expect(result).toMatchObject({ source: 'offer', offerNumber: '2026-0014', price: 41300 })
  })

  it('follows a recalculation of the same offer', async () => {
    const { db, supabase } = setup({ offers: [offer({ id: 'o1', offer_number: '2026-0014', final_price: 41300 })] })
    await syncDealPriceFromOffers(supabase, { dealId: DEAL, companyId: COMPANY })

    ;(db.offers[0] as { final_price: number }).final_price = 38000 // discount / changed items
    const result = await syncDealPriceFromOffers(supabase, { dealId: DEAL, companyId: COMPANY })

    expect(result.status).toBe('written')
    expect(dealRow(db).price).toBe(38000)
    expect(readPriceSource(dealRow(db).project_config)).toMatchObject({ offerId: 'o1', amount: 38000 })
  })

  it('does nothing when the amount is already in sync', async () => {
    const { supabase } = setup({ offers: [offer({ id: 'o1', final_price: 500 })] })
    await syncDealPriceFromOffers(supabase, { dealId: DEAL, companyId: COMPANY })
    const again = await syncDealPriceFromOffers(supabase, { dealId: DEAL, companyId: COMPANY })
    expect(again.status).toBe('noop')
  })

  it('with several offers uses the latest one, then moves to the previous one when it is deleted', async () => {
    const { db, supabase } = setup({
      offers: [
        offer({ id: 'old', offer_number: '2026-0010', final_price: 30000, created_at: '2026-10-01T10:00:00.000Z' }),
        offer({ id: 'new', offer_number: '2026-0014', final_price: 45000, created_at: '2026-10-05T10:00:00.000Z' }),
      ],
    })
    await syncDealPriceFromOffers(supabase, { dealId: DEAL, companyId: COMPANY })
    expect(dealRow(db).price).toBe(45000)

    db.offers = db.offers.filter((o) => o.id !== 'new') // the latest offer is cancelled (deleted)
    const result = await syncDealPriceFromOffers(supabase, { dealId: DEAL, companyId: COMPANY })

    expect(result.status).toBe('written')
    expect(dealRow(db).price).toBe(30000)
    expect(readPriceSource(dealRow(db).project_config)).toMatchObject({ offerId: 'old', offerNumber: '2026-0010' })
  })

  it('an accepted offer wins over a newer unsigned one', async () => {
    const { db, supabase } = setup({
      offers: [
        offer({
          id: 'signed',
          offer_number: '2026-0010',
          final_price: 30000,
          approved: true,
          approved_at: '2026-10-02T10:00:00.000Z',
          created_at: '2026-10-01T10:00:00.000Z',
        }),
        offer({ id: 'newer', offer_number: '2026-0014', final_price: 45000, created_at: '2026-10-05T10:00:00.000Z' }),
      ],
    })
    await syncDealPriceFromOffers(supabase, { dealId: DEAL, companyId: COMPANY })
    expect(dealRow(db).price).toBe(30000)
    expect(readPriceSource(dealRow(db).project_config)).toMatchObject({ offerId: 'signed' })
  })

  it('moves the amount to the signed offer when the customer approves a non-latest offer', async () => {
    const { db, supabase } = setup({
      offers: [
        offer({ id: 'first', offer_number: '2026-0010', final_price: 30000, created_at: '2026-10-01T10:00:00.000Z' }),
        offer({ id: 'second', offer_number: '2026-0014', final_price: 45000, created_at: '2026-10-05T10:00:00.000Z' }),
      ],
    })
    await syncDealPriceFromOffers(supabase, { dealId: DEAL, companyId: COMPANY })
    expect(dealRow(db).price).toBe(45000)

    Object.assign(db.offers[0], { approved: true, approved_at: '2026-10-06T10:00:00.000Z' })
    await syncDealPriceFromOffers(supabase, { dealId: DEAL, companyId: COMPANY })
    expect(dealRow(db).price).toBe(30000)
  })

  it('does not silently overwrite a manual amount: reports a conflict instead', async () => {
    const { db, supabase } = setup({
      deal: {
        price: 52000,
        project_config: withPriceSource(null, manualPriceSource(52000, '2026-10-02T10:00:00.000Z')),
      },
      offers: [offer({ id: 'o1', offer_number: '2026-0014', final_price: 41300 })],
    })
    const result = await syncDealPriceFromOffers(supabase, { dealId: DEAL, companyId: COMPANY })

    expect(result.status).toBe('conflict')
    expect(result.conflict).toMatchObject({ current: 52000, proposed: 41300, offerNumber: '2026-0014' })
    expect(dealRow(db).price).toBe(52000)
    expect(readPriceSource(dealRow(db).project_config)?.source).toBe('manual')
  })

  it('treats an untracked price (typed before this feature) as manual', async () => {
    const { db, supabase } = setup({
      deal: { price: 52000 },
      offers: [offer({ id: 'o1', final_price: 41300 })],
    })
    const result = await syncDealPriceFromOffers(supabase, { dealId: DEAL, companyId: COMPANY })
    expect(result.status).toBe('conflict')
    expect(dealRow(db).price).toBe(52000)
  })

  it('treats an amount changed after the last sync as manual even without a manual mark', async () => {
    const { db, supabase } = setup({ offers: [offer({ id: 'o1', final_price: 41300 })] })
    await syncDealPriceFromOffers(supabase, { dealId: DEAL, companyId: COMPANY })
    dealRow(db).price = 40000 // edited by something that did not record the source

    ;(db.offers[0] as { final_price: number }).final_price = 38000
    const result = await syncDealPriceFromOffers(supabase, { dealId: DEAL, companyId: COMPANY })
    expect(result.status).toBe('conflict')
    expect(dealRow(db).price).toBe(40000)
  })

  it('overwrites a manual amount only after confirmation, and the source becomes the offer', async () => {
    const { db, supabase } = setup({
      deal: { price: 52000, project_config: withPriceSource(null, manualPriceSource(52000, '2026-10-02T10:00:00.000Z')) },
      offers: [offer({ id: 'o1', offer_number: '2026-0014', final_price: 41300 })],
    })
    const result = await syncDealPriceFromOffers(supabase, { dealId: DEAL, companyId: COMPANY, confirm: true })

    expect(result.status).toBe('written')
    expect(dealRow(db).price).toBe(41300)
    expect(readPriceSource(dealRow(db).project_config)).toMatchObject({ source: 'offer', offerId: 'o1' })
  })

  it('attaches the source without a conflict when a manual amount equals the offer total', async () => {
    const { db, supabase } = setup({
      deal: { price: 41300 },
      offers: [offer({ id: 'o1', offer_number: '2026-0014', final_price: 41300 })],
    })
    const result = await syncDealPriceFromOffers(supabase, { dealId: DEAL, companyId: COMPANY })
    expect(result.status).toBe('written')
    expect(readPriceSource(dealRow(db).project_config)).toMatchObject({ source: 'offer', offerId: 'o1' })
  })

  it('keeps unrelated project_config keys', async () => {
    const { db, supabase } = setup({
      deal: { project_config: { product_lines: ['pergola'], warranty: { scopes: ['pergola'] } } },
      offers: [offer({ id: 'o1', final_price: 100 })],
    })
    await syncDealPriceFromOffers(supabase, { dealId: DEAL, companyId: COMPANY })
    expect(dealRow(db).project_config).toMatchObject({
      product_lines: ['pergola'],
      warranty: { scopes: ['pergola'] },
    })
  })

  it('drops the dead source link, but keeps the amount, when the last offer is deleted', async () => {
    const { db, supabase } = setup({ offers: [offer({ id: 'o1', final_price: 41300 })] })
    await syncDealPriceFromOffers(supabase, { dealId: DEAL, companyId: COMPANY })
    db.offers = []
    await syncDealPriceFromOffers(supabase, { dealId: DEAL, companyId: COMPANY })
    expect(dealRow(db).price).toBe(41300)
    expect(readPriceSource(dealRow(db).project_config)).toBeNull()
  })

  it('skips a hidden quick-offer deal and never touches another company', async () => {
    const hidden = setup({ deal: { source: 'quick_offer' }, offers: [offer({ id: 'o1' })] })
    expect((await syncDealPriceFromOffers(hidden.supabase, { dealId: DEAL, companyId: COMPANY })).status).toBe(
      'skipped-hidden',
    )
    expect(dealRow(hidden.db).price).toBeNull()

    const other = setup({ offers: [offer({ id: 'o1' })] })
    expect((await syncDealPriceFromOffers(other.supabase, { dealId: DEAL, companyId: 'company-2' })).status).toBe(
      'no-deal',
    )
  })

  it('throws when the deal update fails, so the caller can roll the offer back', async () => {
    const db: Db = {
      deals: [{ id: DEAL, company_id: COMPANY, source: 'quick_offer_saved', price: null, project_config: null }],
      offers: [offer({ id: 'o1' })],
    }
    const supabase = createFakeSupabase(db, { failOn: new Set(['deals.update']) }) as unknown as SupabaseClient
    await expect(syncDealPriceFromOffers(supabase, { dealId: DEAL, companyId: COMPANY })).rejects.toThrow(
      /deal price update failed/,
    )
    await expect(trySyncDealPrice(supabase, { dealId: DEAL, companyId: COMPANY, context: 'test' })).resolves.toBeNull()
  })
})

describe('getDealPriceState', () => {
  it('reports the manual source and the amount an update would write', async () => {
    const { supabase } = setup({
      deal: { price: 52000, project_config: withPriceSource(null, manualPriceSource(52000, '2026-10-02T10:00:00.000Z')) },
      offers: [offer({ id: 'o1', offer_number: '2026-0014', final_price: 41300 })],
    })
    const state = await getDealPriceState(supabase, DEAL, COMPANY)
    expect(state).toMatchObject({
      source: 'manual',
      price: 52000,
      conflict: { proposed: 41300, offerNumber: '2026-0014' },
      effective: { id: 'o1', amount: 41300 },
    })
  })

  it('reports the offer source after a sync', async () => {
    const { supabase } = setup({ offers: [offer({ id: 'o1', offer_number: '2026-0014', final_price: 41300 })] })
    await syncDealPriceFromOffers(supabase, { dealId: DEAL, companyId: COMPANY })
    const state = await getDealPriceState(supabase, DEAL, COMPANY)
    expect(state).toMatchObject({ source: 'offer', offerNumber: '2026-0014', conflict: null })
  })
})

describe('decidePriceSync', () => {
  const effective = { id: 'o1', offerNumber: '2026-0014', amount: 1000, approved: false }

  it('rounds to agorot so 1000 and 1000.004 are the same amount', () => {
    const decision = decidePriceSync({
      price: 1000.004,
      projectConfig: withPriceSource(null, {
        source: 'offer',
        offerId: 'o1',
        offerNumber: '2026-0014',
        amount: 1000,
        syncedAt: '',
      }),
      effective,
      hasAnyOffer: true,
    })
    expect(decision).toEqual({ kind: 'noop', reason: 'up-to-date' })
  })

  it('is a no-op without offers', () => {
    expect(decidePriceSync({ price: 5, projectConfig: null, effective: null, hasAnyOffer: false })).toEqual({
      kind: 'noop',
      reason: 'no-offer',
    })
  })
})
