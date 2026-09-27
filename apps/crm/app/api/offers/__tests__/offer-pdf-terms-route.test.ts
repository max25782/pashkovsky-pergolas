import { NextRequest } from 'next/server'
import { buildCurrentOfferTermsSnapshot } from '@/lib/offers/offer-terms-snapshot'
import { PERGOLA_PLAN_SCHEMA_VERSION } from '@pashkovsky/pergola-core'

const mockOfferSingle = jest.fn()

jest.mock('@/lib/pdf/render-html-to-pdf', () => ({
  renderHtmlToPdfBuffer: jest.fn(async (html: string) => Buffer.from(html, 'utf8')),
}))

jest.mock('@/lib/middleware/auth-async', () => ({
  requireAuthAsync: jest.fn(),
}))

jest.mock('@/lib/pdf/company-pdf-locale', () => ({
  fetchPdfLocaleForOffer: jest.fn().mockResolvedValue('he'),
  mergeUiPdfLocale: jest.fn((_ui: string | null) => 'he'),
}))

jest.mock('@/lib/s3-upload', () => ({
  uploadToS3: jest.fn().mockResolvedValue('https://example.com/offer.pdf'),
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: mockOfferSingle,
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ error: null }),
      })),
    })),
  })),
}))

import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { POST as quickOfferPdfPost } from '@/app/api/quick-offer/[id]/pdf/route'
import { POST as offersPdfPost } from '@/app/api/offers/[id]/pdf/route'

const requireAuth = requireAuthAsync as jest.MockedFunction<typeof requireAuthAsync>

function pergolaPlanRow() {
  return {
    plan: {
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon: [
        { x: 0, y: 0 },
        { x: 4000, y: 0 },
        { x: 4000, y: 3000 },
        { x: 0, y: 3000 },
      ],
      wallIndices: [],
      params: {
        lamellaPatternId: 'all-70',
        lamellaGapMm: 20,
        lamellaDirectionDeg: 0,
        lamellaOnEdge: false,
        visturMode: false,
        beamProfileId: 'f10040',
        purlinProfileId: 'purlin-led-6040',
        postProfileId: 'f8080',
      },
      confirmed: true,
    },
    shape: { type: 'rectangle', width: 4, length: 3 },
    pergolaType: 'fixed',
    pricePerSqm: 750,
  }
}

function baseOfferRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    deal_id: 'deal-1',
    company_id: 'company-1',
    customer_name: 'Route PDF Test',
    offer_number: '2026-0042',
    terms_snapshot: buildCurrentOfferTermsSnapshot(),
    quick_offer_extra: { includePergola: true, quickProduct: 'pergola' },
    pergolas_data: [pergolaPlanRow()],
    color_type: 'white',
    roof_type: null,
    shading_ratio: null,
    finish_type: null,
    finish_value: '',
    santaf_enabled: false,
    santaf_with_structure: false,
    santaf_price_per_sqm_basic: 220,
    santaf_price_per_sqm_with_structure: 450,
    zip_screen_enabled: false,
    zip_screen_type: null,
    zip_screen_price_per_sqm_manual: 650,
    zip_screen_price_per_sqm_electric: 800,
    lighting_enabled: false,
    lighting_price_per_meter: 200,
    drainage_enabled: false,
    drainage_price_per_meter: 500,
    winter_closure_enabled: false,
    winter_closure_items: [],
    options_notes: null,
    area: 12,
    pergola_total: 9000,
    santaf_total: 0,
    zip_screen_total: 0,
    lighting_total: 0,
    drainage_total: 0,
    winter_closure_total: 0,
    total_before_vat: 9000,
    vat_percent: 18,
    vat_amount: 1620,
    price_with_vat: 10620,
    discount_percent: 0,
    discount_amount: 0,
    final_price: 10620,
    approved: false,
    created_at: '2026-03-01T10:00:00.000Z',
    updated_at: '2026-03-01T10:00:00.000Z',
    pdf_url: null,
    pdf_created_at: null,
    pdf_locale: null,
    ...overrides,
  }
}

async function htmlFromQuickOfferPdf(offerRow: Record<string, unknown>): Promise<string> {
  mockOfferSingle.mockResolvedValue({ data: offerRow, error: null })
  requireAuth.mockResolvedValue({
    authorized: true,
    user: { id: 'u1', email: 'a@b.com', role: 'admin' },
    context: { userId: 'u1', companyId: 'company-1', email: 'a@b.com', role: 'admin' },
  } as Awaited<ReturnType<typeof requireAuthAsync>>)

  const res = await quickOfferPdfPost(
    new NextRequest('http://localhost/api/quick-offer/x/pdf?locale=he', { method: 'POST' }),
    { params: { id: offerRow.id as string } },
  )
  expect(res.status).toBe(200)
  return Buffer.from(await res.arrayBuffer()).toString('utf8')
}

async function htmlFromOffersPdf(offerRow: Record<string, unknown>): Promise<string> {
  mockOfferSingle.mockResolvedValue({ data: offerRow, error: null })

  const res = await offersPdfPost(
    new NextRequest('http://localhost/api/offers/x/pdf?force=true&locale=he', { method: 'POST' }),
    { params: { id: offerRow.id as string } },
  )
  expect(res.status).toBe(200)
  const json = (await res.json()) as { pdfUrl?: string }
  expect(json.pdfUrl).toBeTruthy()
  const { uploadToS3 } = await import('@/lib/s3-upload')
  const uploaded = (uploadToS3 as jest.Mock).mock.calls.at(-1)?.[0] as Buffer
  return uploaded.toString('utf8')
}

describe('offer PDF routes — terms snapshot regression', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'http://localhost:54321'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
    mockOfferSingle.mockReset()
    jest.clearAllMocks()
  })

  it('POST /api/quick-offer/[id]/pdf renders snapshot 20/80 and offer number', async () => {
    const html = await htmlFromQuickOfferPdf(baseOfferRow())
    expect(html).toContain('2026-0042')
    expect(html).toMatch(/<td>20%<\/td><td>מקדמה<\/td>/)
    expect(html).toMatch(/<td>80%<\/td><td>יתרה<\/td>/)
    expect(html).toContain('30 ימי עבודה')
    expect(html).not.toMatch(/<td>10%<\/td><td>מקדמה<\/td>/)
    expect(html).not.toMatch(/35 ימי עבודה/)
    expect(html).toContain('1. תנאי ביצוע')
    expect(html).toContain('4. רישוי ואחריות משפטית')
    expect(html).toMatch(/terms-table-block[\s\S]*אופציות תשלום/)
  })

  it('POST /api/offers/[id]/pdf renders snapshot 20/80 and offer number', async () => {
    const html = await htmlFromOffersPdf(baseOfferRow())
    expect(html).toContain('2026-0042')
    expect(html).toMatch(/<td>20%<\/td><td>מקדמה<\/td>/)
    expect(html).toContain('30 ימי עבודה')
  })

  it('POST /api/quick-offer/[id]/pdf without snapshot uses legacy 10/90 and 35 days', async () => {
    const html = await htmlFromQuickOfferPdf(
      baseOfferRow({ terms_snapshot: null, offer_number: null }),
    )
    expect(html).toMatch(/<td>10%<\/td><td>מקדמה<\/td>/)
    expect(html).toMatch(/<td>90%<\/td><td>יתרה<\/td>/)
    expect(html).toContain('35 ימי עבודה')
    expect(html).not.toMatch(/<td>20%<\/td><td>מקדמה<\/td>/)
  })

  it('POST /api/offers/[id]/pdf without snapshot uses legacy 10/90 and 35 days', async () => {
    const html = await htmlFromOffersPdf(
      baseOfferRow({ terms_snapshot: null, offer_number: null }),
    )
    expect(html).toMatch(/<td>10%<\/td><td>מקדמה<\/td>/)
    expect(html).toContain('35 ימי עבודה')
  })
})
