import { describe, expect, it } from 'vitest'
import {
  ANGLE_30_PROFILE_ID,
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  PERGOLA_CONSTRUCTION_PROFILES,
  angleProfileDimensions,
  barPackLowerBound,
  buildAngleCutPieces,
  buildLamellaSections,
  buildPiecesFromPlan,
  specFromPlan,
} from '@pashkovsky/pergola-core'
import { buildProfileBundlePlans, DEFAULT_KERF_MM } from '../order-sheet'

describe('11204 pack report', () => {
  it('prints bars, bound and waste', () => {
    const polygon: [number, number][] = [
      [0, 0],
      [4068.4687027231466, 0],
      [5106.934332450832, 2553.0978158093785],
      [-6000.023638426626, 2553.09781580938],
      [-4324.502411119518, -3946.5830654311662],
      [-1096.0842946293496, -3946.5830654311662],
    ]
    const params = {
      ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      beamProfileId: 'R242',
      purlinProfileId: 'PA3022',
      postProfileId: 'F100100',
      wingShelfProfileId: 'F4060',
      wallProfileId: 'pa1162',
      colorHex: '#9aa0a6',
    }
    const built = buildPiecesFromPlan({ contour: polygon, wallEdgeIndices: [], params }, PERGOLA_CONSTRUCTION_PROFILES)
    const sections = buildLamellaSections(specFromPlan({ contour: polygon, wallEdgeIndices: [], params }), PERGOLA_CONSTRUCTION_PROFILES)
    const profiles = new Map(PERGOLA_CONSTRUCTION_PROFILES)
    profiles.set(ANGLE_30_PROFILE_ID, angleProfileDimensions())
    const angles = buildAngleCutPieces(sections, params.colorHex)
    const plans = buildProfileBundlePlans([...built.pieces, ...angles], profiles, DEFAULT_KERF_MM)
    const rows = plans.map((plan) => {
      const stock = plan.recommendedStockLengthMm
      const chosen = plan.options.find((option) => option.stockLengthMm === stock)?.plan
      if (!chosen || stock == null) return { profile: plan.profileId, bars: null }
      const slots = chosen.bars.flatMap((bar) => {
        const kerfEach = bar.pieces.length > 0
          ? (bar.usedMm - bar.pieces.reduce((sum, item) => sum + item.lengthLongMm, 0)) / bar.pieces.length
          : 0
        return bar.pieces.map((piece) => piece.lengthLongMm + kerfEach)
      })
      return {
        profile: plan.profileId,
        stock,
        bars: chosen.totalBars,
        lower: barPackLowerBound(slots, stock),
        wasteSum: Math.round(chosen.totalWasteMm),
        remnantBars: chosen.bars.filter((bar) => bar.wasteMm > 1).length,
        wastes: chosen.bars.map((bar) => Math.round(bar.wasteMm)).sort((a, b) => a - b),
        kg: plan.weightKgPerMeter == null ? null : Number(((chosen.totalBars * stock / 1000) * plan.weightKgPerMeter).toFixed(1)),
      }
    })
    const byId = new Map(rows.map((row) => [row.profile, row]))
    expect(byId.get('PA3022')).toMatchObject({ stock: 7000, bars: 5, lower: 5, wasteSum: 5369, kg: 66.2 })
    expect(byId.get('F100100')).toMatchObject({ bars: 7, lower: 6, kg: 94.2 })
    expect(byId.get('F4060')).toMatchObject({ bars: 1, kg: 4.3 })
    // f7020 bars rose 73→74 after trapezoid rows pack from the wider end (same
    // physical side both windings): two tip cells keep one extra short cut each.
    expect(byId.get('f7020')).toMatchObject({ bars: 74, lower: 72, kg: 182.5 })
    expect(byId.get('R242')).toMatchObject({ bars: 6, lower: 5, kg: 106.2 })
    expect(byId.get('p1034')).toMatchObject({ stock: 6000, bars: 14, lower: 12, kg: 29.7 })
    const structural = [94.2, 4.3, 182.5, 66.2, 106.2].reduce((sum, kg) => sum + kg, 0)
    expect(Number(structural.toFixed(1))).toBe(453.4)
    const pa = plans.find((plan) => plan.profileId === 'PA3022')
    const optionWaste = pa?.options.map((option) => ({
      stock: option.stockLengthMm,
      bars: option.plan?.totalBars,
      waste: option.plan ? Math.round(option.plan.totalWasteMm) : null,
    }))
    expect(optionWaste).toEqual([
      { stock: 6000, bars: 6, waste: 6369 },
      { stock: 6500, bars: 6, waste: 9369 },
      { stock: 7000, bars: 5, waste: 5369 },
    ])
    expect(sections.length).toBe(20)
    expect(angles.length).toBe(40)
  })
})
