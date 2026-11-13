process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
process.env.EMAIL_USER = 'test@example.com'
process.env.EMAIL_PASS = 'secret'

const COMPANY_A = 'company-a'
const COMPANY_B = 'company-b'

const offers = [
  {
    id: 'offer-a',
    company_id: COMPANY_A,
    options_notes: null,
    final_price: 1000,
    discount_percent: 0,
    quick_offer_extra: null,
  },
  {
    id: 'offer-b',
    company_id: COMPANY_B,
    options_notes: null,
    final_price: 2000,
    discount_percent: 0,
    quick_offer_extra: null,
  },
]

const sendEmail = jest.fn(async (_opts: { to: string; subject: string; html: string }) => ({ success: true }))

jest.mock('@/lib/email', () => ({
  sendEmail: (opts: { to: string; subject: string; html: string }) => sendEmail(opts),
  generateOfferEmailHTML: () => '<html>offer</html>',
}))

jest.mock('@/lib/middleware/auth', () => ({
  requirePermissionAsync: jest.fn(),
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from(table: string) {
      if (table !== 'offers') throw new Error(`unexpected table ${table}`)
      const filters: Array<[string, unknown]> = []
      const api = {
        select() {
          return api
        },
        eq(col: string, value: unknown) {
          filters.push([col, value])
          return api
        },
        async maybeSingle() {
          const row =
            offers.find((o) => filters.every(([col, value]) => (o as Record<string, unknown>)[col] === value)) ??
            null
          return { data: row, error: null }
        },
        async single() {
          const row =
            offers.find((o) => filters.every(([col, value]) => (o as Record<string, unknown>)[col] === value)) ??
            null
          return { data: row, error: row ? null : { message: 'not found' } }
        },
      }
      return api
    },
  })),
}))

import { NextRequest } from 'next/server'
import { requirePermissionAsync } from '@/lib/middleware/auth'
import { POST } from '../route'

const requirePermission = requirePermissionAsync as jest.MockedFunction<typeof requirePermissionAsync>

function post(offerId: string, body: Record<string, unknown> = { email: 'client@example.com' }) {
  return POST(
    new NextRequest(`http://localhost/api/offers/${offerId}/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: { id: offerId } },
  )
}

describe('POST /api/offers/[id]/send-email', () => {
  beforeEach(() => {
    sendEmail.mockClear()
    requirePermission.mockReset()
  })

  it('401 without a session — nothing is sent', async () => {
    requirePermission.mockResolvedValue({
      authorized: false,
      error: new Response(JSON.stringify({ error: 'Unauthorized: No valid token' }), { status: 401 }) as never,
    })
    const res = await post('offer-a')
    expect(res.status).toBe(401)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('404 when firm A asks to send firm B offer — nothing is sent', async () => {
    requirePermission.mockResolvedValue({ authorized: true, role: 'admin', companyId: COMPANY_A })
    const res = await post('offer-b')
    expect(res.status).toBe(404)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('sends when the offer belongs to the caller firm', async () => {
    requirePermission.mockResolvedValue({ authorized: true, role: 'admin', companyId: COMPANY_A })
    const res = await post('offer-a', { email: 'client@example.com', customerName: 'Client' })
    expect(res.status).toBe(200)
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail.mock.calls[0]?.[0]).toMatchObject({ to: 'client@example.com' })
  })
})
