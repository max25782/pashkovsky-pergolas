/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/leads/route'

jest.mock('@/lib/rate-limit', () => ({
  leadsLimiter: null,
  getClientIp: () => '203.0.113.7',
  checkLimit: jest.fn(async () => ({ allowed: true })),
}))

import { checkLimit } from '@/lib/rate-limit'

const validBody = {
  first_name: 'Dan',
  last_name: 'Levi',
  phone: '052-449-4848',
  city: 'Haifa',
  service: 'pergola',
  details: { width_m: 6 },
  consent: true,
  lang: 'en',
  page_url: 'https://example.com/new',
  utm: {},
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const ENV_KEYS = ['NEXT_PUBLIC_LEADS_DEMO', 'LEADS_REAL_ENABLED', 'VERCEL_ENV', 'CRM_SITE_TOKEN', 'NEXT_PUBLIC_CRM_SITE_TOKEN'] as const
const saved: Record<string, string | undefined> = {}

function enableRealMode(): void {
  process.env.NEXT_PUBLIC_LEADS_DEMO = 'false'
  process.env.LEADS_REAL_ENABLED = 'true'
  process.env.VERCEL_ENV = 'production'
  process.env.CRM_SITE_TOKEN = 'test-token'
}

describe('POST /api/leads', () => {
  const fetchMock = jest.fn()

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key]
      delete process.env[key]
    }
    fetchMock.mockReset()
    global.fetch = fetchMock as unknown as typeof fetch
    ;(checkLimit as jest.Mock).mockResolvedValue({ allowed: true })
    // The route logs upstream failures on purpose; keep the test output readable.
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  })

  it('is disabled by default: 403 and nothing is forwarded', async () => {
    const response = await POST(makeRequest(validBody))
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'leads_disabled' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['preview deployment', { VERCEL_ENV: 'preview' }],
    ['server flag missing', { LEADS_REAL_ENABLED: undefined }],
    ['public flag still demo', { NEXT_PUBLIC_LEADS_DEMO: 'true' }],
  ])('stays disabled when only some flags are set (%s)', async (_label, override) => {
    enableRealMode()
    for (const [key, value] of Object.entries(override)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    const response = await POST(makeRequest(validBody))
    expect(response.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('forwards a valid lead to the CRM when production and both flags are set', async () => {
    enableRealMode()
    fetchMock.mockResolvedValue({ ok: true, status: 200 })
    const response = await POST(makeRequest({ ...validBody, 'cf-turnstile-response': 'tok' }))
    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/\/api\/public\/leads$/)
    expect((init.headers as Record<string, string>)['x-site-token']).toBe('test-token')
    const sent = JSON.parse(init.body as string) as Record<string, unknown>
    expect(sent.source).toBe('new-site')
    expect(sent.phone).toBe('+972524494848')
    expect(sent['cf-turnstile-response']).toBe('tok')
  })

  it('answers 400 for malformed JSON and 422 for invalid data', async () => {
    enableRealMode()
    expect((await POST(makeRequest('{not json'))).status).toBe(400)
    const invalid = await POST(makeRequest({ ...validBody, phone: '1', consent: false }))
    expect(invalid.status).toBe(422)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('swallows honeypot submissions without forwarding', async () => {
    enableRealMode()
    const response = await POST(makeRequest({ ...validBody, website: 'http://spam.example' }))
    expect(response.status).toBe(200)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('answers 429 with Retry-After when rate limited', async () => {
    enableRealMode()
    ;(checkLimit as jest.Mock).mockResolvedValue({ allowed: false, retryAfter: 42 })
    const response = await POST(makeRequest(validBody))
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('42')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('answers 502 when the CRM rejects or is unreachable', async () => {
    enableRealMode()
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 })
    expect((await POST(makeRequest(validBody))).status).toBe(502)
    fetchMock.mockRejectedValueOnce(new Error('network down'))
    expect((await POST(makeRequest(validBody))).status).toBe(502)
  })

  it('answers 500 when no CRM token is configured', async () => {
    enableRealMode()
    delete process.env.CRM_SITE_TOKEN
    const response = await POST(makeRequest(validBody))
    expect(response.status).toBe(500)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
