import { NextRequest, NextResponse } from 'next/server'

const mockMaybeSingle = jest.fn()
const mockEq = jest.fn()

interface OfferQuery {
  eq: (column: string, value: string) => OfferQuery
  maybeSingle: typeof mockMaybeSingle
}

function queryChain(): OfferQuery {
  const chain: OfferQuery = {
    eq: (column: string, value: string) => {
      mockEq(column, value)
      return chain
    },
    maybeSingle: mockMaybeSingle,
  }
  return chain
}

jest.mock('@/lib/middleware/auth-async', () => ({
  requireAuthAsync: jest.fn(),
}))

jest.mock('@/lib/middleware/company-context', () => ({
  getCompanyIdAsync: jest.fn(),
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: () => ({
      select: () => queryChain(),
    }),
  })),
}))

import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { getCompanyIdAsync } from '@/lib/middleware/company-context'
import { PATCH } from '@/app/api/quick-offer/[id]/route'

const requireAuth = requireAuthAsync as jest.MockedFunction<typeof requireAuthAsync>
const getCompanyId = getCompanyIdAsync as jest.MockedFunction<typeof getCompanyIdAsync>

function patchRequest() {
  return new NextRequest('http://localhost/api/quick-offer/offer-1', {
    method: 'PATCH',
    body: JSON.stringify({ includePergola: true }),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('PATCH /api/quick-offer/[id] ownership', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'http://localhost:54321'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test'
    mockMaybeSingle.mockReset()
    mockEq.mockClear()
  })

  it('returns 401 without authorization', async () => {
    requireAuth.mockResolvedValue({
      authorized: false,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })

    const res = await PATCH(patchRequest(), { params: { id: 'offer-1' } })
    expect(res.status).toBe(401)
    expect(mockMaybeSingle).not.toHaveBeenCalled()
  })

  it('returns 404 when the offer is not in the caller company', async () => {
    requireAuth.mockResolvedValue({
      authorized: true,
      user: { id: 'user-1', email: 'a@example.com', role: 'admin' },
      context: { userId: 'user-1', companyId: 'company-a', email: 'a@example.com', role: 'admin' },
    } as Awaited<ReturnType<typeof requireAuthAsync>>)
    getCompanyId.mockResolvedValue('company-a')
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })

    const res = await PATCH(patchRequest(), { params: { id: 'foreign-offer' } })
    expect(res.status).toBe(404)
    expect(mockEq).toHaveBeenCalledWith('id', 'foreign-offer')
    expect(mockEq).toHaveBeenCalledWith('company_id', 'company-a')
  })
})
