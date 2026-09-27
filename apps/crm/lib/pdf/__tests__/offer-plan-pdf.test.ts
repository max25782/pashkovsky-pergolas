import { DEFAULT_PLAN_CONSTRUCTION_PARAMS, PERGOLA_PLAN_SCHEMA_VERSION, polygonAreaM2 } from '@pashkovsky/pergola-core'
import { DEFAULT_OFFER_VALUES, type Offer, type OfferDraft, type Pergola } from '@/types/offer'
import { calculateOffer } from '@/lib/offer-calculator'
import { STANDARD_INSTALLATION_PAYMENT_TERMS } from '@/lib/commercial/standard-installation-terms'
import { renderOfferHtml } from '@/lib/pdf/offer-html-template'
import { pdfT } from '@/lib/pdf/offer-pdf-i18n'
import { buildCurrentOfferTermsSnapshot } from '@/lib/offers/offer-terms-snapshot'
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
    paymentTerms: STANDARD_INSTALLATION_PAYMENT_TERMS,
    warranty: { years: 7, covers: [] },
    termsSnapshot: buildCurrentOfferTermsSnapshot(),
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
const TRAPEZOID = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 3500, y: 3000 },
  { x: 500, y: 3000 },
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
    expect(html).toContain('פרגולה 1')
    expect(html).toContain('פרגולה 2')
    expect(html).not.toContain('צלע 1')
    expect(html).not.toContain('planPolygon')
  })

  it('prints non-orthogonal schematic note under the plan drawing', async () => {
    const html = await renderOfferHtml(
      { ...asOffer([planPergola(TRAPEZOID)]), customerName: 'בדיקה טרפז' },
      null,
      true,
      'he',
    )
    expect(html).toContain(pdfT.he.off_non_orthogonal_pdf_note)
    expect(html).toContain('viz-non-orthogonal')
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

function segmentHitsAabb(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): boolean {
  let t0 = 0
  let t1 = 1
  const dx = bx - ax
  const dy = by - ay
  const p = [-dx, dx, -dy, dy]
  const q = [ax - minX, maxX - ax, ay - minY, maxY - ay]
  for (let index = 0; index < 4; index += 1) {
    if (p[index] === 0) {
      if (q[index] < 0) return false
      continue
    }
    const ratio = q[index] / p[index]
    if (p[index] < 0) {
      if (ratio > t1) return false
      if (ratio > t0) t0 = ratio
    } else {
      if (ratio < t0) return false
      if (ratio < t1) t1 = ratio
    }
  }
  return t0 <= t1
}

function labelsStayOffContour(
  polygon: Array<{ x: number; y: number }>,
  labels: Array<{ x: number; y: number; halfWidth: number; halfHeight: number }>,
): boolean {
  return labels.every((label) => {
    const minX = label.x - label.halfWidth
    const maxX = label.x + label.halfWidth
    const minY = label.y - label.halfHeight
    const maxY = label.y + label.halfHeight
    return polygon.every((point, index) => {
      const next = polygon[(index + 1) % polygon.length]
      return !segmentHitsAabb(point.x, point.y, next.x, next.y, minX, minY, maxX, maxY)
    })
  })
}

describe('planContourSvg', () => {
  function drawing() {
    return jest.requireActual<typeof import('@/lib/pdf/polygon-plan-drawing.server')>(
      '@/lib/pdf/polygon-plan-drawing.server',
    )
  }

  it('draws the confirmed contour and its edge lengths', () => {
    const svg = drawing().planContourSvg(RECT, [0])
    expect(svg).toContain('data-plan-contour="1"')
    expect(svg).toContain('>4000<')
    expect(svg).toContain('>6000<')
  })

  it('places rectangle labels outside the contour, horizontal above and below, vertical beside', () => {
    const labels = drawing().placeContourDimensionLabels(RECT)
    expect(labelsStayOffContour(RECT, labels)).toBe(true)
    const bottom = labels.find((label) => label.text === '4000' && label.y < 0)
    const top = labels.find((label) => label.text === '4000' && label.y > 6000)
    const right = labels.find((label) => label.text === '6000' && label.x > 4000)
    const left = labels.find((label) => label.text === '6000' && label.x < 0)
    expect(bottom?.x).toBe(2000)
    expect(top?.x).toBe(2000)
    expect(right?.y).toBe(3000)
    expect(left?.y).toBe(3000)
  })

  it('keeps L-shape and trapezoid labels off the contour lines', () => {
    const lShape = [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 2000 },
      { x: 2000, y: 2000 },
      { x: 2000, y: 4000 },
      { x: 0, y: 4000 },
    ]
    const height = 3000
    const leftRun = Math.sqrt(3849 ** 2 - height ** 2)
    const rightRun = Math.sqrt(3190 ** 2 - height ** 2)
    const trapezoid = [
      { x: 0, y: 0 },
      { x: 7030, y: 0 },
      { x: 7030 - rightRun, y: height },
      { x: leftRun, y: height },
    ]
    const { placeContourDimensionLabels, planContourSvg } = drawing()
    expect(labelsStayOffContour(lShape, placeContourDimensionLabels(lShape))).toBe(true)
    const trapLabels = placeContourDimensionLabels(trapezoid)
    expect(labelsStayOffContour(trapezoid, trapLabels)).toBe(true)
    const svg = planContourSvg(trapezoid)
    expect(svg).toContain('>7030<')
    expect(svg).toContain('>3849<')
    expect(svg).toContain('>3190<')
    expect(svg).not.toContain('#1d4ed8')
    expect(svg.match(/fill="#111827"/g)?.length).toBe(trapLabels.length)
  })
})