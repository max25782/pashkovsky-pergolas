process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'

const COMPANY_A = 'company-a'
const COMPANY_B = 'company-b'

type DealRow = {
  id: string
  company_id: string
  customer_name: string
  customer_type: string | null
  stage: string
  price: number
  my_cost: number
  installation_date: string | null
  order_date: string | null
  created_at: string
}

type PaymentRow = { deal_id: string; company_id: string; amount: number; paid_at: string }

const deals: DealRow[] = [
  {
    id: 'a-done',
    company_id: COMPANY_A,
    customer_name: 'A Done',
    customer_type: 'private',
    stage: 'done',
    price: 10000,
    my_cost: 1000,
    installation_date: '2026-10-15T10:00:00.000Z',
    order_date: null,
    created_at: '2026-09-01T10:00:00.000Z',
  },
  {
    id: 'b-done',
    company_id: COMPANY_B,
    customer_name: 'B Done SECRET',
    customer_type: 'private',
    stage: 'done',
    price: 99999,
    my_cost: 1,
    installation_date: '2026-10-15T10:00:00.000Z',
    order_date: null,
    created_at: '2026-09-01T10:00:00.000Z',
  },
  {
    id: 'b-contractor',
    company_id: COMPANY_B,
    customer_name: 'B Contractor SECRET',
    customer_type: 'contractor',
    stage: 'production',
    price: 50000,
    my_cost: 1,
    installation_date: null,
    order_date: null,
    created_at: '2026-10-05T10:00:00.000Z',
  },
]

const payments: PaymentRow[] = [
  { deal_id: 'a-done', company_id: COMPANY_A, amount: 10000, paid_at: '2026-10-16T10:00:00.000Z' },
  { deal_id: 'b-done', company_id: COMPANY_B, amount: 99999, paid_at: '2026-10-16T10:00:00.000Z' },
]

jest.mock('@/lib/middleware/auth', () => ({
  requirePermissionAsync: jest.fn(),
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from(table: string) {
      const filters: Array<[string, unknown]> = []
      const api = {
        select() {
          return api
        },
        eq(col: string, value: unknown) {
          filters.push([col, value])
          return api
        },
        not() {
          return api
        },
        gte() {
          return api
        },
        lte() {
          return api
        },
        then(resolve: (v: { data: unknown[]; error: null }) => unknown) {
          const rows = table === 'deals' ? deals : payments
          const data = rows.filter((row) =>
            filters.every(([col, value]) => (row as Record<string, unknown>)[col] === value),
          )
          return Promise.resolve(resolve({ data, error: null }))
        },
      }
      return api
    },
  })),
}))

import { NextRequest } from 'next/server'
import { requirePermissionAsync } from '@/lib/middleware/auth'
import { GET } from '../route'

const requirePermission = requirePermissionAsync as jest.MockedFunction<typeof requirePermissionAsync>

function get(month = '2026-10') {
  return GET(new NextRequest(`http://localhost/api/reports/monthly?month=${month}`))
}

describe('GET /api/reports/monthly', () => {
  beforeEach(() => {
    requirePermission.mockReset()
  })

  it('401 without a session', async () => {
    requirePermission.mockResolvedValue({
      authorized: false,
      error: new Response(JSON.stringify({ error: 'Unauthorized: No valid token' }), { status: 401 }) as never,
    })
    const res = await get()
    expect(res.status).toBe(401)
  })

  it('403 for a role that is not owner or admin (reports:export)', async () => {
    requirePermission.mockResolvedValue({
      authorized: false,
      error: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) as never,
    })
    const res = await get()
    expect(res.status).toBe(403)
  })

  it('returns only firm A data; firm B deals and payments never appear', async () => {
    requirePermission.mockResolvedValue({ authorized: true, role: 'owner', companyId: COMPANY_A })
    const res = await get()
    expect(res.status).toBe(200)
    const body = await res.json()
    const names = (body.report.projects ?? body.report?.projects ?? []).map(
      (p: { customerName?: string; projectName?: string }) => p.customerName ?? p.projectName,
    )
    const blob = JSON.stringify(body)
    expect(blob).toContain('A Done')
    expect(blob).not.toContain('SECRET')
    expect(blob).not.toContain('99999')
    expect(names.every((n: string) => !String(n).includes('SECRET'))).toBe(true)
  })
})
