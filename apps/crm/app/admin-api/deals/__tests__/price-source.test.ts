/**
 * Manual edits of the deal amount (the deal card's price field -> PATCH /admin-api/deals)
 * are marked "manual" on the server, so an offer sync cannot overwrite them silently.
 */
import { NextRequest } from 'next/server'
import type { Db } from '@/lib/deals/__tests__/fake-supabase'

const mockDb: Db = {}

jest.mock('@/lib/middleware/auth-async', () => ({
  requireAuthAsync: jest.fn(async () => ({ authorized: true, user: { id: 'user-1' }, context: { companyId: 'company-1' } })),
}))

jest.mock('@/lib/middleware/company-context', () => ({
  getCompanyId: jest.fn(() => 'company-1'),
  getCompanyIdAsync: jest.fn(async () => 'company-1'),
}))

jest.mock('@/lib/audit/logger', () => ({
  logDealEvent: jest.fn(async () => undefined),
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

import { PATCH } from '@/app/admin-api/deals/route'
import { readPriceSource, syncDealPriceFromOffers } from '@/lib/deals/deal-price-sync'
import { createFakeSupabase } from '@/lib/deals/__tests__/fake-supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

function patch(body: Record<string, unknown>) {
  return PATCH(
    new NextRequest('http://localhost/admin-api/deals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

const deal = () => mockDb.deals[0] as { price: number | null; project_config: Record<string, unknown> | null }

beforeEach(() => {
  for (const key of Object.keys(mockDb)) delete mockDb[key]
  mockDb.deals = [
    {
      id: 'deal-1',
      company_id: 'company-1',
      source: 'quick_offer_saved',
      price: null,
      project_config: { product_lines: ['pergola'] },
    },
  ]
  mockDb.offers = [
    {
      id: 'o1',
      deal_id: 'deal-1',
      company_id: 'company-1',
      offer_number: '2026-0014',
      final_price: 41300,
      approved: false,
      approved_at: null,
      created_at: '2026-10-01T10:00:00.000Z',
    },
  ]
})

describe('PATCH /admin-api/deals amount provenance', () => {
  it('marks a hand-typed amount as manual and keeps other project_config keys', async () => {
    const res = await patch({ id: 'deal-1', price: 52000 })
    expect(res.status).toBe(200)
    expect(deal().price).toBe(52000)
    expect(readPriceSource(deal().project_config)).toMatchObject({ source: 'manual', amount: 52000 })
    expect(deal().project_config).toMatchObject({ product_lines: ['pergola'] })
  })

  it('after the manual edit an offer sync reports a conflict and leaves the amount alone', async () => {
    await patch({ id: 'deal-1', price: 52000 })
    const supabase = createFakeSupabase(mockDb) as unknown as SupabaseClient
    const result = await syncDealPriceFromOffers(supabase, { dealId: 'deal-1', companyId: 'company-1' })

    expect(result.status).toBe('conflict')
    expect(deal().price).toBe(52000)
  })

  it('a manual edit over an offer-sourced amount becomes manual', async () => {
    const supabase = createFakeSupabase(mockDb) as unknown as SupabaseClient
    await syncDealPriceFromOffers(supabase, { dealId: 'deal-1', companyId: 'company-1' })
    expect(readPriceSource(deal().project_config)?.source).toBe('offer')

    await patch({ id: 'deal-1', price: 39000 })
    expect(readPriceSource(deal().project_config)).toMatchObject({ source: 'manual', amount: 39000 })
  })

  it('does not change the source when the saved price equals the stored one', async () => {
    const supabase = createFakeSupabase(mockDb) as unknown as SupabaseClient
    await syncDealPriceFromOffers(supabase, { dealId: 'deal-1', companyId: 'company-1' })

    await patch({ id: 'deal-1', price: 41300, notes: 'same amount, other field' })
    expect(readPriceSource(deal().project_config)?.source).toBe('offer')
  })

  it('a stale project_config from the client cannot drop the stored source', async () => {
    const supabase = createFakeSupabase(mockDb) as unknown as SupabaseClient
    await syncDealPriceFromOffers(supabase, { dealId: 'deal-1', companyId: 'company-1' })

    await patch({ id: 'deal-1', project_config: { product_lines: ['pergola', 'fence'] } })
    expect(readPriceSource(deal().project_config)?.source).toBe('offer')
    expect(deal().project_config).toMatchObject({ product_lines: ['pergola', 'fence'] })
  })

  it('clearing the amount removes the source', async () => {
    await patch({ id: 'deal-1', price: 52000 })
    await patch({ id: 'deal-1', price: null })
    expect(readPriceSource(deal().project_config)).toBeNull()
  })
})
