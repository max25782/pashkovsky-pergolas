import { NextRequest } from 'next/server'
import { DEFAULT_OFFER_VALUES } from '@/types/offer'

const inserts: Array<{ table: string; row: Record<string, unknown> }> = []

jest.mock('@/lib/middleware/auth-async', () => ({
  requireAuthAsync: jest.fn(async () => ({ authorized: true, user: { id: 'user-1' } })),
}))

jest.mock('@/lib/middleware/company-context', () => ({
  getCompanyIdAsync: jest.fn(async () => 'company-1'),
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    rpc: jest.fn(async () => ({ data: '2026-0108', error: null })),
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        inserts.push({ table, row })
        return {
          select: () => ({
            single: async () => ({
              data: { id: table === 'deals' ? 'deal-1' : 'offer-1' },
              error: null,
            }),
          }),
        }
      },
      delete: () => ({
        eq: async () => ({ error: null }),
      }),
    }),
  })),
}))

process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'

import type { NextRequest as NextRequestType } from 'next/server'

let POST: (req: NextRequestType) => Promise<Response>

beforeAll(async () => {
  jest.resetModules()
  const route = await import('@/app/api/quick-offer/route')
  POST = route.POST
})

function fenceBody(customerName: unknown) {
  return {
    ...DEFAULT_OFFER_VALUES,
    customerName,
    includePergola: false,
    includeRailings: false,
    includeFence: true,
    pergolas: [],
    quickFence: {
      ...DEFAULT_OFFER_VALUES.quickFence,
      metersTotal: 10,
      heightCm: 180,
      fenceVariant: 'classic',
      color: 'לבן',
    },
  }
}

function post(customerName: unknown) {
  return POST(
    new NextRequest('http://localhost/api/quick-offer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fenceBody(customerName)),
    }),
  )
}

describe('POST /api/quick-offer customer name', () => {
  beforeEach(() => {
    inserts.length = 0
  })

  it('rejects a missing name with 400 and does not insert', async () => {
    const res = await post(undefined)
    expect(res.status).toBe(400)
    expect(inserts).toHaveLength(0)
  })

  it('rejects a whitespace name with 400 and does not insert', async () => {
    const res = await post('   ')
    expect(res.status).toBe(400)
    expect(inserts).toHaveLength(0)
  })

  it('stores the given name on the deal and the offer', async () => {
    const res = await post('  דוד כהן  ')
    expect(res.status).toBe(201)
    const deal = inserts.find((entry) => entry.table === 'deals')
    const offer = inserts.find((entry) => entry.table === 'offers')
    expect(deal?.row.customer_name).toBe('דוד כהן')
    expect(offer?.row.customer_name).toBe('דוד כהן')
  })
})
