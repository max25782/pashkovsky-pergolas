/**
 * Quick Offer bound to a deal: the deal amount is written by the server in the same request
 * as the offer, follows recalculation, and a failed amount write removes the offer again.
 */
import { NextRequest } from 'next/server'
import { DEFAULT_OFFER_VALUES } from '@/types/offer'
import type { Db } from '@/lib/deals/__tests__/fake-supabase'

const mockDb: Db = {}
const mockFailOn = new Set<string>()

jest.mock('@/lib/middleware/auth-async', () => ({
  requireAuthAsync: jest.fn(async () => ({ authorized: true, user: { id: 'user-1' } })),
}))

jest.mock('@/lib/middleware/company-context', () => ({
  getCompanyIdAsync: jest.fn(async () => 'company-1'),
}))

jest.mock('@/lib/audit/logger', () => ({
  logAuditEvent: jest.fn(async () => undefined),
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => {
    const { createFakeSupabase } = jest.requireActual<typeof import('@/lib/deals/__tests__/fake-supabase')>(
      '@/lib/deals/__tests__/fake-supabase',
    )
    return createFakeSupabase(mockDb, { failOn: mockFailOn, rpc: () => '2026-0014' })
  }),
}))

process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'

import { POST } from '@/app/api/quick-offer/route'
import { PATCH } from '@/app/api/quick-offer/[id]/route'
import { readPriceSource } from '@/lib/deals/deal-price-sync'

function fenceBody(overrides: Record<string, unknown> = {}, metersTotal = 10) {
  return {
    ...DEFAULT_OFFER_VALUES,
    customerName: 'דוד כהן',
    includePergola: false,
    includeRailings: false,
    includeFence: true,
    pergolas: [],
    quickFence: {
      ...DEFAULT_OFFER_VALUES.quickFence,
      metersTotal,
      heightCm: 180,
      fenceVariant: 'classic',
      color: 'לבן',
    },
    ...overrides,
  }
}

function post(body: Record<string, unknown>) {
  return POST(
    new NextRequest('http://localhost/api/quick-offer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

function patch(offerId: string, body: Record<string, unknown>) {
  return PATCH(
    new NextRequest(`http://localhost/api/quick-offer/${offerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: { id: offerId } },
  )
}

const deal = () => mockDb.deals.find((d) => d.id === 'deal-9') as { price: number | null; project_config: unknown }
const offers = () => mockDb.offers as Array<{ id: string; final_price: number; offer_number: string }>

beforeEach(() => {
  mockFailOn.clear()
  for (const key of Object.keys(mockDb)) delete mockDb[key]
  mockDb.deals = [
    { id: 'deal-9', company_id: 'company-1', source: 'quick_offer_saved', price: null, project_config: null },
  ]
  mockDb.offers = []
})

describe('POST /api/quick-offer bound to a deal', () => {
  it('writes the offer total into the deal amount in the same request, with the source', async () => {
    const res = await post(fenceBody({ dealId: 'deal-9' }))
    expect(res.status).toBe(201)
    const json = await res.json()

    expect(json.dealId).toBe('deal-9')
    expect(offers()).toHaveLength(1)
    expect(offers()[0].offer_number).toBe('2026-0014')
    expect(offers()[0].final_price).toBeGreaterThan(0)
    // The amount is the client-visible total (final_price) of the offer that was just created.
    expect(deal().price).toBe(offers()[0].final_price)
    expect(readPriceSource(deal().project_config)).toMatchObject({
      source: 'offer',
      offerId: json.offerId,
      offerNumber: '2026-0014',
    })
    expect(json.dealPrice).toMatchObject({ status: 'written', price: offers()[0].final_price, source: 'offer' })
    // No second deal was created and the existing one was reused.
    expect(mockDb.deals).toHaveLength(1)
  })

  it('removes the offer again when the deal amount cannot be written (no offer without an amount)', async () => {
    mockFailOn.add('deals.update')
    const res = await post(fenceBody({ dealId: 'deal-9' }))

    expect(res.status).toBe(500)
    expect(offers()).toHaveLength(0)
    expect(mockDb.deals).toHaveLength(1) // the existing deal is never deleted by the rollback
    expect(deal().price).toBeNull()
  })

  it('reports a conflict and keeps a manual amount', async () => {
    deal().price = 99000
    const res = await post(fenceBody({ dealId: 'deal-9' }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.dealPrice.status).toBe('conflict')
    expect(json.dealPrice.conflict).toMatchObject({ current: 99000, offerNumber: '2026-0014' })
    expect(deal().price).toBe(99000)
    expect(offers()).toHaveLength(1)
  })

  it('rejects a deal of another company and creates nothing', async () => {
    ;(mockDb.deals[0] as { company_id: string }).company_id = 'company-2'
    const res = await post(fenceBody({ dealId: 'deal-9' }))
    expect(res.status).toBe(404)
    expect(offers()).toHaveLength(0)
  })

  it('without a deal id still creates a hidden deal and does not write an amount', async () => {
    const res = await post(fenceBody())
    expect(res.status).toBe(201)
    const hidden = mockDb.deals.find((d) => d.source === 'quick_offer') as { price?: unknown } | undefined
    expect(hidden).toBeDefined()
    expect(hidden?.price).toBeUndefined()
  })
})

describe('PATCH /api/quick-offer/[id] recalculation', () => {
  async function createBound() {
    const res = await post(fenceBody({ dealId: 'deal-9' }, 10))
    return (await res.json()) as { offerId: string }
  }

  it('moves the deal amount when the offer is recalculated', async () => {
    const { offerId } = await createBound()
    const firstTotal = offers()[0].final_price

    const res = await patch(offerId, fenceBody({ dealId: 'deal-9' }, 20))
    expect(res.status).toBe(200)

    const secondTotal = offers()[0].final_price
    expect(secondTotal).toBeGreaterThan(firstTotal)
    expect(deal().price).toBe(secondTotal)
    expect(readPriceSource(deal().project_config)).toMatchObject({ offerId, amount: secondTotal })
    expect((await res.json()).dealPrice.status).toBe('written')
  })

  it('does not overwrite a manual amount typed after creation; reports a conflict', async () => {
    const { offerId } = await createBound()
    deal().price = 77000 // changed by hand, source not marked (e.g. older client)

    const res = await patch(offerId, fenceBody({ dealId: 'deal-9' }, 20))
    expect(res.status).toBe(200)
    expect(deal().price).toBe(77000)
    expect((await res.json()).dealPrice.status).toBe('conflict')
  })

  it('restores the previous offer when the deal amount cannot be updated', async () => {
    const { offerId } = await createBound()
    const firstTotal = offers()[0].final_price

    mockFailOn.add('deals.update')
    const res = await patch(offerId, fenceBody({ dealId: 'deal-9' }, 20))

    expect(res.status).toBe(500)
    expect(offers()[0].final_price).toBe(firstTotal)
    expect(deal().price).toBe(firstTotal)
  })
})
