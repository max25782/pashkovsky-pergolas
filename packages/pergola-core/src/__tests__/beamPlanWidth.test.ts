import { describe, it, expect } from 'vitest'
import {
  attachBeamPlanWidth,
  beamPlanWidthForDrawing,
  DIVIDER_PLAN_CLEARANCE_WIDTH_MM,
  resolveBeamPlanWidth,
  BEAM_PLAN_WIDTH_MISSING_WARNING,
} from '../beamPlanWidth'
import { computePurlinClearGapsMm } from '../topPlanDimensions'
import { computeFrame } from '../frame'
import { buildOuterPerimeterDimensionChains } from '../topPlanDimensions'
import { pieceAxis } from '../pieceAxis'
import { CONSTRUCTION_BEAM_IDS, PERGOLA_CONSTRUCTION_PROFILES } from '../pergolaProfiles'
import { listConstructionBeamPlanWidths } from '../beamPlanWidth'
import type { PergolaSpec, Point2D, ProfileDimensions } from '../types'

describe('beamPlanWidth (Max drawing rules)', () => {
  it('rule-min: smaller section side in plan', () => {
    expect(resolveBeamPlanWidth('מלבן 200/50', 'x', 200, 50)).toMatchObject({
      planWidthMm: 50,
      planWidthSource: 'rule-min',
    })
    expect(resolveBeamPlanWidth('מלבן 120/40', 'x', 120, 40)).toMatchObject({
      planWidthMm: 40,
      planWidthSource: 'rule-min',
    })
    expect(resolveBeamPlanWidth('מלבן 40/120', 'x', 40, 120)).toMatchObject({
      planWidthMm: 40,
      planWidthSource: 'rule-min',
    })
    expect(resolveBeamPlanWidth('מלבן 120/40 עובי 4', 'x', 120, 40)).toMatchObject({
      planWidthMm: 40,
      planWidthSource: 'rule-min',
    })
  })

  it('double T -> override-70 (pa1429 דאבל טי 120, 2.314 kg/m)', () => {
    expect(resolveBeamPlanWidth('דאבל טי 120', 'pa1429', 70, 120)).toMatchObject({
      planWidthMm: 70,
      planWidthSource: 'override-70',
    })
    expect(resolveBeamPlanWidth('דאבל טי מעוצב (הייטק) 120', 'PA268 דאבל טי מעוצב 120', 70, 120)).toMatchObject({
      planWidthMm: 70,
      planWidthSource: 'override-70',
    })
  })

  it('unparsed section -> fallback 40 + warning', () => {
    const r = resolveBeamPlanWidth(undefined, null, 0, 0)
    expect(r.planWidthMm).toBe(40)
    expect(r.planWidthSource).toBe('fallback-40')
    expect(r.planWidthWarning).toBe(BEAM_PLAN_WIDTH_MISSING_WARNING)
  })

  it('frame profile 40 -> 70 changes outer bottom by 2×30 mm', () => {
    const POST: ProfileDimensions = { widthMm: 80, heightMm: 80 }
    const PROFILES = new Map<string, ProfileDimensions>([
      ['beam-40', attachBeamPlanWidth({ widthMm: 40, heightMm: 100, maxSpanMm: 6000 }, 'מלבן 40/120', 'beam-40')],
      ['beam-70', attachBeamPlanWidth({ widthMm: 70, heightMm: 120, maxSpanMm: 6000 }, 'דאבל טי 120', 'pa1429')],
      ['post-1', POST],
    ])
    const contour: Point2D[] = [[0, 0], [6000, 0], [6000, 3000], [0, 3000]]
    const centroid: Point2D = [3000, 1500]
    const spec40: PergolaSpec = {
      contour,
      heightMm: 2600,
      lamellaGapMm: 20,
      lamellaAngleDeg: 0,
      lamellaDirectionDeg: 0,
      postProfileId: 'post-1',
      beamProfileId: 'beam-40',
      lamellaProfileId: 'lam-1',
      color: '#fff',
    }
    const spec70 = { ...spec40, beamProfileId: 'beam-70' }
    const frame40 = computeFrame(spec40, PROFILES)
    const frame70 = computeFrame(spec70, PROFILES)
    const sides40 = frame40.beams.map((b) => {
      const { start, end } = pieceAxis(b)
      return { id: b.id, start, end }
    })
    const sides70 = frame70.beams.map((b) => {
      const { start, end } = pieceAxis(b)
      return { id: b.id, start, end }
    })
    const bottom40 = buildOuterPerimeterDimensionChains(
      sides40,
      frame40.beams,
      40,
      centroid,
      (b) => beamPlanWidthForDrawing(PROFILES, b.profileId).planWidthMm,
    ).find((ch) => ch.segmentsMm[0] > 5000)!
    const bottom70 = buildOuterPerimeterDimensionChains(
      sides70,
      frame70.beams,
      70,
      centroid,
      (b) => beamPlanWidthForDrawing(PROFILES, b.profileId).planWidthMm,
    ).find((ch) => ch.segmentsMm[0] > 5000)!
    expect(bottom70.segmentsMm[0] - bottom40.segmentsMm[0]).toBeCloseTo(30, 0)

    const gaps40 = computePurlinClearGapsMm({
      rangeMinMm: 0,
      rangeMaxMm: 6000,
      beamWidthMm: 40,
      dividerWidthMm: DIVIDER_PLAN_CLEARANCE_WIDTH_MM,
      dividerPositions: [{ id: 'div-1', positionMm: 3000 }],
    })
    const gaps70 = computePurlinClearGapsMm({
      rangeMinMm: 0,
      rangeMaxMm: 6000,
      beamWidthMm: 70,
      dividerWidthMm: DIVIDER_PLAN_CLEARANCE_WIDTH_MM,
      dividerPositions: [{ id: 'div-1', positionMm: 3000 }],
    })
    expect(gaps40[0] - gaps70[0]).toBeCloseTo(30, 0)
    expect(gaps40[1] - gaps70[1]).toBeCloseTo(30, 0)
  })

  it('purlin profile 120/40 still uses 40 mm divider clearance', () => {
    const gaps = computePurlinClearGapsMm({
      rangeMinMm: 0,
      rangeMaxMm: 6000,
      beamWidthMm: 40,
      dividerWidthMm: DIVIDER_PLAN_CLEARANCE_WIDTH_MM,
      dividerPositions: [
        { id: 'div-1', positionMm: 2000 },
        { id: 'div-2', positionMm: 4000 },
      ],
    })
    expect(gaps[1]).toBeCloseTo(2000 - DIVIDER_PLAN_CLEARANCE_WIDTH_MM, 3)
  })

  it('construction catalog beams have planWidthMm attached', () => {
    const f10040 = PERGOLA_CONSTRUCTION_PROFILES.get('f10040')
    expect(f10040?.planWidthMm).toBe(40)
    expect(f10040?.planWidthSource).toBe('rule-min')
    const r242 = PERGOLA_CONSTRUCTION_PROFILES.get('R242')
    expect(r242?.planWidthMm).toBe(70)
    expect(r242?.planWidthSource).toBe('override-70')
    const table = listConstructionBeamPlanWidths(PERGOLA_CONSTRUCTION_PROFILES, CONSTRUCTION_BEAM_IDS)
    expect(table.length).toBeGreaterThan(0)
    for (const row of table) {
      expect(row.planWidthMm).toBeGreaterThan(0)
      expect(['rule-min', 'override-70', 'fallback-40']).toContain(row.source)
    }
  })
})
