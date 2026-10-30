import { describe, expect, it } from 'vitest'
import {
  DEFAULT_KERF_MM,
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  PERGOLA_CONSTRUCTION_PROFILES,
  buildPiecesFromPlan,
  computeFrame,
  effectiveKerfMm,
  specFromPlan,
  type ProfileDimensions,
} from '@pashkovsky/pergola-core'
import { buildOrderSheetTotals, buildProfileBundlePlans, contourBeamEdgeIndex, piecesForCutting } from '../order-sheet'
import { renderCuttingPages, renderOrderPages, renderProductionSummary } from '../cut-map'

/** A frame profile with no kg/m and an 8 m bar. It stands in for any catalog row without weight. */
const NO_WEIGHT_ID = 'test-no-weight-50x120'
const NO_WEIGHT: ProfileDimensions = {
  widthMm: 50,
  heightMm: 120,
  planWidthMm: 50,
  planWidthSource: 'rule-min',
  availableStockLengthsMm: [6000, 7000, 8000],
}
const PROFILES = new Map(PERGOLA_CONSTRUCTION_PROFILES)
PROFILES.set(NO_WEIGHT_ID, NO_WEIGHT)

const LIVE_L: [number, number][] = [
  [0, 0],
  [4000, 0],
  [4000, 3000],
  [11960, 3000],
  [11960, 6460],
  [0, 6460],
]
const MEASURED = [4000, 3000, 8000, 3500, 12000, 6500]

function liveParams(beamProfileId = NO_WEIGHT_ID) {
  return {
    ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
    measuredOuterLengthMmByEdgeIndex: MEASURED,
    purlinMaxSpanMm: 4000,
    purlinProfileId: 'PA3022',
    beamProfileId,
    lamellaDirectionDeg: 0,
    lamellaSectionLayoutVersion: 1 as const,
    purlinClearLayoutVersion: 1 as const,
  }
}

function slotMm(lengthLongMm: number, miterStart: number, miterEnd: number): number {
  return lengthLongMm + Math.max(
    effectiveKerfMm(DEFAULT_KERF_MM, miterStart, 0),
    effectiveKerfMm(DEFAULT_KERF_MM, miterEnd, 0),
  )
}

describe('a frame profile without kg/m on the 12 m L', () => {
  it('lists every contour beam and packs the ones that are not on a wall', () => {
    const params = liveParams()
    const spec = specFromPlan({ contour: LIVE_L, wallEdgeIndices: [], params })
    const frame = computeFrame(spec, PROFILES)
    const contour = frame.beams
      .filter((beam) => beam.profileId === NO_WEIGHT_ID)
      .map((beam) => ({
        n: (contourBeamEdgeIndex(beam.id) ?? 0) + 1,
        lengthMm: Math.round(beam.lengthLongMm),
        wall: false,
      }))
    expect(contour).toEqual([
      { n: 1, lengthMm: 4000, wall: false },
      { n: 2, lengthMm: 3000, wall: false },
      { n: 3, lengthMm: 8000, wall: false },
      { n: 4, lengthMm: 3500, wall: false },
      { n: 5, lengthMm: 12000, wall: false },
      { n: 6, lengthMm: 6500, wall: false },
    ])

    const built = buildPiecesFromPlan({ contour: LIVE_L, wallEdgeIndices: [], params }, PROFILES)
    const beams = built.pieces.filter((piece) => piece.profileId === NO_WEIGHT_ID)
    expect(beams.length).toBeGreaterThan(6)
    for (const beam of beams) {
      expect(slotMm(beam.lengthLongMm, beam.cutMiterStartDeg, beam.cutMiterEndDeg)).toBeLessThanOrEqual(8000)
    }
    const plans = buildProfileBundlePlans(piecesForCutting(built.pieces, []), PROFILES)
    const bundle = plans.find((plan) => plan.profileId === NO_WEIGHT_ID)
    expect(bundle?.recommendedStockLengthMm).toBe(8000)
    expect(bundle?.weightKgPerMeter).toBeUndefined()
    const chosen = bundle?.options.find((option) => option.stockLengthMm === 8000)?.plan
    expect(chosen?.totalBars).toBeGreaterThan(0)
    const totals = buildOrderSheetTotals(plans, new Map())
    const row = totals.find((item) => item.profileId === NO_WEIGHT_ID)
    expect(row?.totalBars).toBeGreaterThan(0)
    expect(row?.totalMeters).toBeGreaterThan(0)
    expect(row?.totalWeightKg).toBeNull()

    const labels = {
      title: 'הזמנה',
      wall: 'דופן',
      stock: 'מוט',
      bars: 'מוטות',
      meters: 'מטרים',
      weight: 'משקל',
      weightMissing: 'משקל לא הוגדר',
      profile: 'פרופיל',
      total: 'סה״כ',
      noImage: 'אין תמונה',
      noData: 'אין נתונים',
      schematic: 'חתך סכמטי',
      sharedDrawing: '',
      kerfNote: 'מרוח',
      weightIncomplete: (profile: string) => `משקל פרופיל ${profile} לא הוגדר, הסיכום חלקי`,
      weightExcluding: (profiles: string) => `ללא ${profiles}`,
    }
    const order = renderOrderPages({ plans, profiles: PROFILES, labels, rtl: true }).html
    const summary = renderProductionSummary({
      plans,
      rtl: true,
      labels: {
        title: 'סיכום',
        profile: 'פרופיל',
        bars: 'מוטות',
        meters: 'מטרים',
        weight: 'משקל',
        weightMissing: 'משקל לא הוגדר',
        total: 'סה״כ',
        kerfNote: 'מרוח',
        weightIncomplete: labels.weightIncomplete,
        weightExcluding: labels.weightExcluding,
      },
    })
    expect(order).toContain(NO_WEIGHT_ID)
    expect(order).toContain('משקל לא הוגדר')
    expect(order).toContain(`משקל פרופיל ${NO_WEIGHT_ID} לא הוגדר, הסיכום חלקי`)
    expect(order).toContain(`ללא ${NO_WEIGHT_ID}`)
    expect(summary).toContain(`ללא ${NO_WEIGHT_ID}`)
    const cutting = renderCuttingPages({
      plans,
      profiles: PROFILES,
      rtl: true,
      labels: {
        title: 'חיתוך',
        rest: 'יתרה',
        wall: 'דופן',
        stock: 'מוט',
        bars: 'מוטות',
        weight: 'משקל',
        weightMissing: 'משקל לא הוגדר',
        noImage: 'אין תמונה',
        noData: 'אין נתונים',
        sharedDrawing: '',
        kerf: 'מרוח',
        schematic: 'חתך סכמטי',
        howTitle: '',
        howAngle: '',
        howBeam: '',
        howPart: '',
        howColor: '',
        lamellas: '',
        beamMark: (n: number) => `ק${n}`,
        weightIncomplete: labels.weightIncomplete,
      },
    }).html
    expect(cutting).toContain(NO_WEIGHT_ID)
    expect(cutting).toContain(`משקל פרופיל ${NO_WEIGHT_ID} לא הוגדר, הסיכום חלקי`)
  })

  it('leaves a wall beam out of the order and keeps the free beams', () => {
    const params = liveParams()
    const built = buildPiecesFromPlan({ contour: LIVE_L, wallEdgeIndices: [1], params }, PROFILES)
    const cut = piecesForCutting(built.pieces, [1])
    const beams = cut.filter((piece) => piece.profileId === NO_WEIGHT_ID || piece.role === 'beam')
    expect(built.pieces.some((piece) => piece.id === 'beam-1' || piece.id.startsWith('beam-1-seg'))).toBe(true)
    expect(beams.some((piece) => contourBeamEdgeIndex(piece.id) === 1)).toBe(false)
    expect(beams.some((piece) => contourBeamEdgeIndex(piece.id) === 0)).toBe(true)
    const plans = buildProfileBundlePlans(cut, PROFILES)
    const bundle = plans.find((plan) => plan.profileId === NO_WEIGHT_ID)
    expect(bundle?.pieceCount).toBeGreaterThan(0)
    expect(bundle?.options.some((option) => option.plan != null)).toBe(true)
  })
})
