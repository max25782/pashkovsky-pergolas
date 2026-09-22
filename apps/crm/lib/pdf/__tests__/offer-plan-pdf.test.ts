import { DEFAULT_PLAN_CONSTRUCTION_PARAMS, PERGOLA_PLAN_SCHEMA_VERSION, polygonAreaM2 } from '@pashkovsky/pergola-core'
import { DEFAULT_OFFER_VALUES, type Offer, type OfferDraft, type Pergola } from '@/types/offer'
import { calculateOffer } from '@/lib/offer-calculator'
import { renderOfferHtml } from '@/lib/pdf/offer-html-template'
import { generateDrawingsFromPlan, generateOfferDrawings } from '@/lib/pdf/polygon-plan-drawing.server'

jest.mock('@/lib/pdf/polygon-plan-drawing.server', () => ({
  generateDrawingsFromPlan: jest.fn(async () => ({
    topPlan: '<svg data-mock-plan="1"></svg>',
    lamellaLayout: null,
  })),
  generateOfferDrawings: jest.fn(async () => ({ topPlan: null, lamellaLayout: null })),
}))

function planPergola(polygon: Array<{ x: number; y: number }>, pricePerSqm = 750): Pergola {
  return {
    plan: {
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon,
      wallIndices: [],
      params: { ...DEFAULT_PLAN_CONSTRUCTION_PARAMS },
      confirmed: true,
    },
    shape: { type: 'rectangle', width: 1, length: 1 },
    pergolaType: 'fixed',
    pricePerSqm,
  }
}

function asOffer(pergolas: Pergola[], shapeOnly = false): Offer {
  const draft: OfferDraft = {
    dealId: '',
    customerName: 'PDF',
    quickProduct: 'pergola',
    includePergola: true,
    includeRailings: false,
    includeFence: false,
    quickRailings: { ...DEFAULT_OFFER_VALUES.quickRailings },
    quickFence: { ...DEFAULT_OFFER_VALUES.quickFence },
    pergolas,
    color: { ...DEFAULT_OFFER_VALUES.color },
    roof: { ...DEFAULT_OFFER_VALUES.roof },
    shadingRatio: null,
    finishType: null,
    finishValue: '',
    santaf: { ...DEFAULT_OFFER_VALUES.santaf },
    zipScreen: { ...DEFAULT_OFFER_VALUES.zipScreen },
    lighting: { ...DEFAULT_OFFER_VALUES.lighting },
    drainage: { ...DEFAULT_OFFER_VALUES.drainage },
    winterClosure: { ...DEFAULT_OFFER_VALUES.winterClosure },
    options: {},
    vatPercent: 18,
    discountPercent: 0,
    images: [],
  }
  const calc = calculateOffer(draft)
  return {
    ...draft,
    ...calc,
    id: 'pdf-offer',
    pergolas: shapeOnly ? pergolas.map((p) => ({ ...p, plan: null })) : pergolas,
    pricing: {
      santafTotal: calc.santafTotal,
      zipScreenTotal: calc.zipScreenTotal,
      lightingTotal: calc.lightingTotal,
      drainageTotal: calc.drainageTotal,
      winterClosureTotal: calc.winterClosureTotal,
      totalBeforeVat: calc.totalBeforeVat,
      vatPercent: calc.vatPercent,
      vatAmount: calc.vatAmount,
      priceWithVat: calc.priceWithVat,
      discountPercent: calc.discountPercent,
      discountAmount: calc.discountAmount,
      finalPrice: calc.finalPrice,
    },
    paymentTerms: { advancePercent: 10, remainingPercent: 90, method: 'bankTransfer', text: '' },
    warranty: { years: 7, covers: [] },
    approval: { approved: false },
    pdf: {},
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
  }
}

const RECT = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 6000 },
  { x: 0, y: 6000 },
]
const SMALL = [
  { x: 0, y: 0 },
  { x: 5000, y: 0 },
  { x: 5000, y: 2000 },
  { x: 0, y: 2000 },
]

describe('offer PDF plans', () => {
  beforeEach(() => {
    jest.mocked(generateDrawingsFromPlan).mockClear()
    jest.mocked(generateOfferDrawings).mockClear()
  })

  it('draws each pergola from its polygon and lists both areas', async () => {
    const html = await renderOfferHtml(asOffer([planPergola(RECT), planPergola(SMALL)]), null, true, 'he')
    expect(generateDrawingsFromPlan).toHaveBeenCalledTimes(2)
    expect(generateOfferDrawings).not.toHaveBeenCalled()
    const drawings = html.match(/data-pergola-plan="1"/g) ?? []
    expect(drawings).toHaveLength(2)
    expect(html).toContain(polygonAreaM2(RECT).toFixed(2))
    expect(html).toContain(polygonAreaM2(SMALL).toFixed(2))
    expect(html).not.toContain('planPolygon')
  })

  it('keeps the shape spec for an old offer without plans', async () => {
    const legacy: Pergola = {
      plan: null,
      shape: { type: 'rectangle', width: 3.5, length: 2.25 },
      pergolaType: 'fixed',
      pricePerSqm: 750,
    }
    const html = await renderOfferHtml(asOffer([legacy], true), null, true, 'he')
    expect(generateDrawingsFromPlan).not.toHaveBeenCalled()
    expect(html).toContain('3.5 × 2.25')
    expect(html).toContain('מלבן')
    expect(html).not.toContain('מתוך שרטוט')
    expect(html).not.toContain('data-pergola-plan')
    expect(html).toContain('<svg')
  })
})

describe('planContourSvg', () => {
  it('draws the confirmed contour and its edge lengths', () => {
    const { planContourSvg } = jest.requireActual<typeof import('@/lib/pdf/polygon-plan-drawing.server')>(
      '@/lib/pdf/polygon-plan-drawing.server',
    )
    const svg = planContourSvg(RECT, [0])
    expect(svg).toContain('data-plan-contour="1"')
    expect(svg).toContain('>4000<')
    expect(svg).toContain('>6000<')
  })
})