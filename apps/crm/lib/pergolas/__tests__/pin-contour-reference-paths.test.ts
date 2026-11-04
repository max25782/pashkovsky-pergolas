/**
 * Every write path pins contourReference for offer 2026-0004 → purlins stay 2310×3.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  PERGOLA_CONSTRUCTION_PROFILES,
  buildPieces,
  houseConstructionParams,
  paramsFromStoredPlan,
  pinContourReferenceOnParams,
  specFromPlan,
  WING_SHELF_SPAN_DIVIDER_ID,
  type PlanConstructionParams,
  type Point2D,
} from '@pashkovsky/pergola-core'
import { applyPlanGeometry } from '@/lib/pergolas/apply-plan-geometry'
import { normalizePergolas, parsePergolaPlan } from '@/lib/pergolas/normalize-pergola'
import { prepareQuickOfferPergolas } from '@/lib/pergolas/prepare-quick-offer-pergolas'
import { validatePergolaPlanForApi } from '@/lib/pergolas/validate-pergola-plan'
import type { Pergola } from '@/types/offer'

const CONTOUR: Point2D[] = [
  [0, 0],
  [-5200, 0],
  [-5200, 2350],
  [-1100, 2350],
  [-1100, 1350],
  [0, 1350],
]
const POLYGON = CONTOUR.map(([x, y]) => ({ x, y }))
const WALLS = [2, 3, 4]
const MEASURED = CONTOUR.map((a, i) => {
  const b = CONTOUR[(i + 1) % CONTOUR.length]
  return Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]))
})

const baseParams: PlanConstructionParams = {
  ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  lamellaDirectionDeg: 0,
  purlinMaxSpanMm: 4000,
  beamProfileId: 'f10040',
  postProfileId: 'f8080',
  purlinProfileId: 'purlin-led-6040',
  lamellaPatternId: 'all-70',
  lamellaGapMm: 20,
  wallProfileId: 'f10040',
  wallBeamWidthVersion: 1,
}

function purlins(params: PlanConstructionParams) {
  return buildPieces(
    specFromPlan({ contour: CONTOUR, wallEdgeIndices: WALLS, params }),
    PERGOLA_CONSTRUCTION_PROFILES,
  ).pieces
    .filter((p) => p.role === 'purlin' && p.dividerId !== WING_SHELF_SPAN_DIVIDER_ID)
    .map((p) => Math.round(p.lengthAxisMm))
    .sort((a, b) => a - b)
}

/** Simulate ContourReporter inventing measured=edges without prior CR. */
function handleContourChangePin(
  prev: PlanConstructionParams,
  measured?: number[],
): PlanConstructionParams {
  const pinned = pinContourReferenceOnParams(CONTOUR, prev)
  return measured ? { ...pinned, measuredOuterLengthMmByEdgeIndex: measured } : pinned
}

describe('pin contourReference write paths — 2026-0004', () => {
  it('handleContourChange (embed/debug): invent measured keeps 2310', () => {
    const next = handleContourChangePin({ ...baseParams }, MEASURED)
    expect(next.contourReference).toBe('centerline')
    expect(purlins(next)).toEqual([2310, 2310, 2310])
  })

  it('paramsFromStoredPlan + contour: pins centerline', () => {
    const next = paramsFromStoredPlan({ ...baseParams }, CONTOUR)
    expect(next.contourReference).toBe('centerline')
    expect(purlins(next)).toEqual([2310, 2310, 2310])
  })

  it('houseConstructionParams: stays outer-faces (explicit)', () => {
    const next = houseConstructionParams({ ...baseParams })
    expect(next.contourReference).toBe('outer-faces')
  })

  it('parsePergolaPlan (normalize on parse): pins centerline, 2310', () => {
    const plan = parsePergolaPlan({
      schemaVersion: 1,
      polygon: POLYGON,
      wallIndices: WALLS,
      params: { ...baseParams },
      confirmed: false,
    })
    expect(plan).toBeTruthy()
    expect(plan!.params.contourReference).toBe('centerline')
    expect(purlins(plan!.params)).toEqual([2310, 2310, 2310])
  })

  it('parsePergolaPlan after invented measured still centerline when already pinned', () => {
    const first = parsePergolaPlan({
      schemaVersion: 1,
      polygon: POLYGON,
      wallIndices: WALLS,
      params: { ...baseParams },
    })!
    const second = parsePergolaPlan({
      ...first,
      params: { ...first.params, measuredOuterLengthMmByEdgeIndex: MEASURED },
    })!
    expect(second.params.contourReference).toBe('centerline')
    expect(purlins(second.params)).toEqual([2310, 2310, 2310])
  })

  it('applyPlanGeometry: invent measured on resave keeps 2310', () => {
    const prev: Pergola = {
      shape: { type: 'rectangle', width: 5.2, length: 2.35 },
      pricePerSqm: 750,
      plan: {
        schemaVersion: 1,
        polygon: POLYGON,
        wallIndices: WALLS,
        params: { ...baseParams },
        confirmed: true,
      },
    }
    const next = applyPlanGeometry(prev, {
      polygon: POLYGON,
      wallIndices: WALLS,
      params: { ...baseParams, measuredOuterLengthMmByEdgeIndex: MEASURED },
      isClosed: true,
      isSimple: true,
    })
    expect(next.plan?.params.contourReference).toBe('centerline')
    expect(purlins(next.plan!.params)).toEqual([2310, 2310, 2310])
  })

  it('validatePergolaPlanForApi → parse pins centerline', () => {
    const result = validatePergolaPlanForApi({
      schemaVersion: 1,
      polygon: POLYGON,
      wallIndices: WALLS,
      params: { ...baseParams },
      confirmed: true,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.params.contourReference).toBe('centerline')
    expect(purlins(result.plan.params)).toEqual([2310, 2310, 2310])
  })

  it('configurator-save pin helper: same as pinContourReferenceOnParams', () => {
    const pinned = pinContourReferenceOnParams(CONTOUR, { ...baseParams })
    expect(pinned.contourReference).toBe('centerline')
    expect(purlins(pinned)).toEqual([2310, 2310, 2310])
  })

  it('hydrate / sync (normalizePergolas): pins centerline, 2310', () => {
    const list = normalizePergolas([
      {
        shape: { type: 'rectangle', width: 5.2, length: 2.35 },
        pricePerSqm: 750,
        plan: {
          schemaVersion: 1,
          polygon: POLYGON,
          wallIndices: WALLS,
          params: { ...baseParams },
          confirmed: true,
        },
      },
    ])
    expect(list?.[0]?.plan?.params.contourReference).toBe('centerline')
    expect(purlins(list![0].plan!.params)).toEqual([2310, 2310, 2310])
  })

  it('quick-offer / confirm (prepareQuickOfferPergolas): pins centerline, 2310', () => {
    const prepared = prepareQuickOfferPergolas({
      pergolas: [
        {
          shape: { type: 'rectangle', width: 5.2, length: 2.35 },
          pricePerSqm: 750,
          plan: {
            schemaVersion: 1,
            polygon: POLYGON,
            wallIndices: WALLS,
            params: { ...baseParams },
            confirmed: true,
          },
        },
      ],
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.pergolas[0].plan?.params.contourReference).toBe('centerline')
    expect(purlins(prepared.pergolas[0].plan!.params)).toEqual([2310, 2310, 2310])
  })

  it('explicit outer-faces switch (user confirm path) → 2270', () => {
    const pinned = pinContourReferenceOnParams(CONTOUR, { ...baseParams })
    const switched = { ...pinned, contourReference: 'outer-faces' as const }
    expect(purlins(switched)).toEqual([2270, 2270, 2270])
  })
})
