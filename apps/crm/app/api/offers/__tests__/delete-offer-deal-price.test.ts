/**
 * Cancelling (deleting) the latest offer moves the deal amount to the previous offer.
 */
import { NextRequest } from 'next/server'
import type { Db } from '@/lib/deals/__tests__/fake-supabase'

const mockDb: Db = {}

jest.mock('@/lib/middleware/auth-async', () => ({
  requireAuthAsync: jest.fn(async () => ({ authorized: true, user: { id: 'user-1' } })),
}))

jest.mock('@/lib/auth', () => ({
  requireCompanyAccess: jest.fn(async () => ({ authorized: true })),
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => {
    const { createFakeSupabase } = jest.requireActual<typeof import('@/lib/deals/__tests__/fake-supabase')>(
      '@/lib/deals/__tests__/fake-supabase',
    )
    return createFakeSupabase(mockDb)
  }),
}))

process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'

import { DELETE } from '@/app/api/offers/[id]/route'
import { readPriceSource, syncDealPriceFromOffers } from '@/lib/deals/deal-price-sync'
import { createFakeSupabase } from '@/lib/deals/__tests__/fake-supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

function offerRow(id: string, number: string, price: number, createdAt: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    deal_id: 'deal-1',
    company_id: 'company-1',
    offer_number: number,
    final_price: price,
    approved: false,
    approved_at: null,
    created_at: createdAt,
    ...extra,
  }
}

function remove(id: string) {
  return DELETE(new NextRequest(`http://localhost/api/offers/${id}`, { method: 'DELETE' }), { params: { id } })
}

const deal = () => mockDb.deals[0] as { price: number | null; project_config: unknown }

beforeEach(() => {
  for (const key of Object.keys(mockDb)) delete mockDb[key]
  mockDb.deals = [
    { id: 'deal-1', company_id: 'company-1', source: 'quick_offer_saved', price: null, project_config: null },
  ]
})

describe('DELETE /api/offers/[id] and the deal amount', () => {
  it('moves the amount to the previous offer when the latest one is deleted', async () => {
    mockDb.offers = [
      offerRow('old', '2026-0010', 30000, '2026-10-01T10:00:00.000Z'),
      offerRow('new', '2026-0014', 45000, '2026-10-05T10:00:00.000Z'),
    ]
    const supabase = createFakeSupabase(mockDb) as unknown as SupabaseClient
    await syncDealPriceFromOffers(supabase, { dealId: 'deal-1', companyId: 'company-1' })
    expect(deal().price).toBe(45000)

    const res = await remove('new')
    expect(res.status).toBe(200)
    expect(deal().price).toBe(30000)
    expect(readPriceSource(deal().project_config)).toMatchObject({ offerId: 'old', offerNumber: '2026-0010' })
  })

  it('keeps the signed offer as the source when a newer unsigned one is deleted', async () => {
    mockDb.offers = [
      offerRow('signed', '2026-0010', 30000, '2026-10-01T10:00:00.000Z', {
        approved: true,
        approved_at: '2026-10-02T10:00:00.000Z',
      }),
      offerRow('new', '2026-0014', 45000, '2026-10-05T10:00:00.000Z'),
    ]
    const supabase = createFakeSupabase(mockDb) as unknown as SupabaseClient
    await syncDealPriceFromOffers(supabase, { dealId: 'deal-1', companyId: 'company-1' })
    expect(deal().price).toBe(30000)

    await remove('new')
    expect(deal().price).toBe(30000)
    expect(readPriceSource(deal().project_config)).toMatchObject({ offerId: 'signed' })
  })
})
