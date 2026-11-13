process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
process.env.CRM_SITE_TOKEN = 'site-token-a'
process.env.DEFAULT_COMPANY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
process.env.PUBLIC_LEAD_COMPANY_BY_DOMAIN = 'www.other-firm.com:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const inserts: Array<Record<string, unknown>> = []

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(async () => ({ allowed: true, remaining: 5, resetAt: Date.now() + 60_000 })),
  getClientIp: () => '127.0.0.1',
}))

jest.mock('@/lib/captcha/turnstile', () => ({
  verifyTurnstile: jest.fn(async () => ({ success: true })),
}))

jest.mock('@/lib/whatsapp-send', () => ({
  sendWhatsAppTemplate: jest.fn(async () => ({ ok: true })),
}))

jest.mock('@/lib/googleAds/offlineConversion', () => ({
  uploadLeadConversion: jest.fn(async () => undefined),
}))

jest.mock('@/lib/leads/new-lead-defaults', () => ({
  newLeadDefaults: jest.fn(async () => ({})),
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from(table: string) {
      if (table !== 'leads') throw new Error(`unexpected ${table}`)
      return {
        insert(row: Record<string, unknown>) {
          inserts.push(row)
          return {
            select() {
              return {
                single: async () => ({ data: { id: 'lead-1', gclid: null, google_conv_sent: false }, error: null }),
              }
            },
          }
        },
        update() {
          return { eq: async () => ({ error: null }) }
        },
      }
    },
  })),
}))

import { NextRequest } from 'next/server'
import { POST } from '../route'

function post(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return POST(
    new NextRequest('http://localhost/api/public/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({
        name: 'Test Lead',
        phone: '0501234567',
        website: '',
        'cf-turnstile-response': 'ok',
        ...body,
      }),
    }),
  )
}

describe('POST /api/public/leads company scope', () => {
  beforeEach(() => {
    inserts.length = 0
  })

  it('401 when the company cannot be resolved — nothing is inserted', async () => {
    const res = await post({}, { origin: 'https://unknown.example' })
    expect(res.status).toBe(401)
    expect(inserts).toHaveLength(0)
  })

  it('inserts with company_id from the site token (form key)', async () => {
    const res = await post({}, { 'x-site-token': 'site-token-a' })
    expect(res.status).toBe(201)
    expect(inserts).toHaveLength(1)
    expect(inserts[0].company_id).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  })

  it('inserts with company_id from the Origin domain', async () => {
    const res = await post({}, { origin: 'https://www.other-firm.com' })
    expect(res.status).toBe(201)
    expect(inserts).toHaveLength(1)
    expect(inserts[0].company_id).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
  })

  it('401 when form key and domain disagree — nothing is inserted', async () => {
    const res = await post(
      {},
      { 'x-site-token': 'site-token-a', origin: 'https://www.other-firm.com' },
    )
    expect(res.status).toBe(401)
    expect(inserts).toHaveLength(0)
  })
})
