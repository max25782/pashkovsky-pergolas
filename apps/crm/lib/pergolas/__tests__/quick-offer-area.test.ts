import { calculateOffer } from '@/lib/offer-calculator'
import { validatePergolaPlanForApi } from '@/lib/pergolas/validate-pergola-plan'
import { applyPlanGeometry } from '@/lib/pergolas/apply-plan-geometry'
import { DEFAULT_PLAN_CONSTRUCTION_PARAMS, PERGOLA_PLAN_SCHEMA_VERSION } from '@pashkovsky/pergola-core'
import type { OfferDraft, Pergola } from '@/types/offer'

function rectanglePlan(widthMm: number, heightMm: number, confirmed = true) {
  return {
    schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
    polygon: [
      { x: 0, y: 0 },
      { x: widthMm, y: 0 },
      { x: widthMm, y: heightMm },
      { x: 0, y: heightMm },
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
    confirmed,
  }
}

function pergolaWithPlan(plan: ReturnType<typeof rectanglePlan>): Pergola {
  return {
    plan: plan as Pergola['plan'],
    shape: { type: 'rectangle', width: 99, length: 99 },
    pricePerSqm: 750,
  }
}

describe('quick-offer area from plan', () => {
  it('uses polygon area (4000×6000 mm → 24 m²), not spoofed shape', () => {
    const draft: OfferDraft = {
      dealId: 'test-deal',
      customerName: 'Test',
      includePergola: true,
      pergolas: [pergolaWithPlan(rectanglePlan(4000, 6000))],
      color: { type: 'white' },
      roof: { type: null },
      shadingRatio: null,
      finishType: null,
      finishValue: '',
      santaf: {
        enabled: false,
        withStructure: false,
        pricePerSqmBasic: 220,
        pricePerSqmWithStructure: 450,
        overlapType: 'double',
      },
      zipScreen: { enabled: false, pricePerSqmManual: 650, pricePerSqmElectric: 800 },
      lighting: { enabled: false, pricePerMeter: 200 },
      drainage: { enabled: false, pricePerMeter: 500 },
      winterClosure: { enabled: false, items: [] },
      options: {},
      discountPercent: 0,
      vatPercent: 18,
    }

    const calc = calculateOffer(draft)
    expect(calc.area).toBe(24)
    expect(calc.pergolaTotal).toBe(24 * 750)
  })

  it('prices santaf and ZIP from the L-plan polygon, not the bounding box', () => {
    const lPlan = {
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon: [
        { x: 0, y: 0 },
        { x: 6000, y: 0 },
        { x: 6000, y: 3000 },
        { x: 3000, y: 3000 },
        { x: 3000, y: 6000 },
        { x: 0, y: 6000 },
      ],
      wallIndices: [],
      params: rectanglePlan(4000, 6000).params,
      confirmed: true,
    }
    const polygonArea = 27
    const draft: OfferDraft = {
      dealId: 'test-deal',
      customerName: 'Test',
      includePergola: true,
      pergolas: [
        {
          plan: lPlan as Pergola['plan'],
          shape: { type: 'L', leg1: { width: 6, length: 3 }, leg2: { width: 3, length: 3 } },
          pricePerSqm: 100,
        },
      ],
      color: { type: 'white' },
      roof: { type: null },
      shadingRatio: null,
      finishType: null,
      finishValue: '',
      santaf: {
        enabled: true,
        withStructure: false,
        pricePerSqmBasic: 220,
        pricePerSqmWithStructure: 450,
        overlapType: 'double',
      },
      zipScreen: {
        enabled: true,
        type: 'manual',
        pricePerSqmManual: 10,
        pricePerSqmElectric: 20,
      },
      lighting: { enabled: false, pricePerMeter: 200 },
      drainage: { enabled: false, pricePerMeter: 500 },
      winterClosure: { enabled: false, items: [] },
      options: {},
      discountPercent: 0,
      vatPercent: 18,
    }

    const calc = calculateOffer(draft)
    expect(calc.area).toBe(polygonArea)
    expect(calc.santafTotal).toBe(polygonArea * 220)
    expect(calc.zipScreenTotal).toBe(polygonArea * 10)
  })

  it('clears confirmed when the polygon changes and keeps pergola options', () => {
    const prev: Pergola = {
      plan: {
        schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
        polygon: [
          { x: 0, y: 0 },
          { x: 4000, y: 0 },
          { x: 4000, y: 6000 },
          { x: 0, y: 6000 },
        ],
        wallIndices: [],
        params: DEFAULT_PLAN_CONSTRUCTION_PARAMS,
        confirmed: true,
      },
      shape: { type: 'rectangle', width: 4, length: 6 },
      pricePerSqm: 750,
      location: 'גינה',
      pergolaType: 'fixed',
    }
    const next = applyPlanGeometry(prev, {
      polygon: [
        { x: 0, y: 0 },
        { x: 5000, y: 0 },
        { x: 5000, y: 6000 },
        { x: 0, y: 6000 },
      ],
      wallIndices: [0],
      params: DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      isClosed: true,
      isSimple: true,
    })
    expect(next.plan?.confirmed).toBe(false)
    expect(next.pricePerSqm).toBe(750)
    expect(next.location).toBe('גינה')
    expect(next.pergolaType).toBe('fixed')
  })

  it('rejects self-intersecting polygon with 400-class validation helper', () => {
    const bowtie = {
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon: [
        { x: 0, y: 0 },
        { x: 4000, y: 6000 },
        { x: 4000, y: 0 },
        { x: 0, y: 6000 },
      ],
      wallIndices: [],
      params: rectanglePlan(4000, 6000).params,
      confirmed: true,
    }
    const result = validatePergolaPlanForApi(bowtie)
    expect(result.ok).toBe(false)
  })
})
