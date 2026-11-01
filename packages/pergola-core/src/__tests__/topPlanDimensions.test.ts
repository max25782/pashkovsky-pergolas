import { describe, it, expect } from 'vitest'
import {
  buildOuterPerimeterDimensionChains,
  buildTopPlanDimensionModel,
  matchContourEdgeIndex,
  computePurlinClearGapsMm,
  computeEqualPurlinClearMm,
  computeMaxEqualPurlinClearGapMm,
  diagnosePurlinClearsOnPrimarySide,
  formatPurlinClearLabelMm,
  dividerPositionsForMaxEqualClears,
  verifyPurlinClearsAgainstMaxRule,
  buildPurlinClearDimensionChain,
  formatInteriorAngleDeg,
  interiorAngleDegAtVertex,
  outerFaceLengthOnSide,
  profilePlanWidthMm,
  PURLIN_DIVIDER_CLEARANCE_WIDTH_MM,
  verifyPurlinClearSpanConsistency,
} from '../topPlanDimensions'
import { parseCatalogNameDims } from '../supplier/pandaAlum'
import { computeFrame } from '../frame'
import { pieceAxis } from '../pieceAxis'
import { contourRangeAlongLamellaDir, resolvePurlinEndInsetMm, resolvePurlinPositionsMm } from '../lamellaSpans'
import { beamProfileChangePatch, resolvePlanPurlinLines } from '../dividerEdits'
import { DEFAULT_PLAN_CONSTRUCTION_PARAMS } from '../planDefaults'
import { PERGOLA_CONSTRUCTION_PROFILES } from '../pergolaProfiles'
import type { PergolaSpec, Point2D, ProfileDimensions } from '../types'

function beamsToGeometricSides(beams: ReturnType<typeof computeFrame>['beams']) {
  return beams.map((beam) => {
    const { start, end } = pieceAxis(beam)
    return { id: beam.id, start, end }
  })
}

function centroidOf(points: Point2D[]): Point2D {
  const sum = points.reduce<Point2D>((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0])
  return [sum[0] / points.length, sum[1] / points.length]
}

const BEAM: ProfileDimensions = { widthMm: 40, heightMm: 100, maxSpanMm: 6000 }
const POST: ProfileDimensions = { widthMm: 80, heightMm: 80 }
const PURLIN: ProfileDimensions = { widthMm: 40, heightMm: 60, maxSpanMm: 3000, interruptsLamella: true }
const LAM: ProfileDimensions = { widthMm: 70, heightMm: 20, maxLamellaSpanMm: 1500 }
const BEAM_120_40: ProfileDimensions = {
  widthMm: 120,
  heightMm: 40,
  maxSpanMm: 6000,
  planWidthMm: 40,
  planWidthSource: 'rule-min',
}

const PROFILES = new Map<string, ProfileDimensions>([
  ['beam-1', { ...BEAM, planWidthMm: 40, planWidthSource: 'rule-min' }],
  ['beam-120-40', BEAM_120_40],
  ['post-1', POST],
  ['purlin-1', PURLIN],
  ['lam-1', LAM],
])

function baseSpec(contour: Point2D[]): PergolaSpec {
  return {
    contour,
    heightMm: 2600,
    lamellaGapMm: 20,
    lamellaAngleDeg: 0,
    lamellaDirectionDeg: 0,
    postProfileId: 'post-1',
    beamProfileId: 'beam-1',
    lamellaProfileId: 'lam-1',
    purlinProfileId: 'purlin-1',
    color: '#fff',
  }
}

/** Г-образный контур с косой стороной (верх ~13002, право 5374, лево 9996). */
export const G_SLOPE_FIXTURE: Point2D[] = [
  [0, 0],
  [0, 9996],
  [13002, 9996],
  [13002, 4622],
]

describe('topPlanDimensions', () => {
  it('formatInteriorAngleDeg keeps 89.9 as 89.9', () => {
    expect(formatInteriorAngleDeg(89.94)).toBe(89.9)
    expect(formatInteriorAngleDeg(90)).toBe(90)
  })

  it('rectangle corner is 90°', () => {
    const deg = interiorAngleDegAtVertex([0, 0], [6000, 0], [6000, 3000])
    expect(formatInteriorAngleDeg(deg)).toBe(90)
  })

  it('perimeter: one segment per geometric side (no post splits)', () => {
    const contour: Point2D[] = [[0, 0], [6000, 0], [6000, 3000], [0, 3000]]
    const spec = baseSpec(contour)
    const frame = computeFrame(spec, PROFILES)
    const sides = beamsToGeometricSides(frame.beams)
    const chains = buildOuterPerimeterDimensionChains(
      sides,
      frame.beams,
      BEAM.widthMm,
      centroidOf(contour),
    )
    expect(chains).toHaveLength(4)
    for (const chain of chains) {
      expect(chain.points).toHaveLength(2)
      expect(chain.segmentsMm).toHaveLength(1)
    }
  })

  it('G-sloped fixture: one outer length per side, angles at every vertex', () => {
    const contour = [...G_SLOPE_FIXTURE]
    const spec = baseSpec(contour)
    const frame = computeFrame(spec, PROFILES)
    const sides = beamsToGeometricSides(frame.beams)
    const model = buildTopPlanDimensionModel({
      geometricSides: sides,
      beams: frame.beams,
      profiles: PROFILES,
      beamProfileId: 'beam-1',
      centroid: centroidOf(contour),
      contourVertices: contour,
      lamellaDirectionDeg: 0,
      dividerPositions: [],
    })

    expect(model.perimeterChains).toHaveLength(4)
    model.perimeterChains.forEach((c) => {
      expect(c.segmentsMm).toHaveLength(1)
    })
    expect(model.vertexAngles).toHaveLength(4)

    const top = model.perimeterChains.find((_, i) => {
      const s = sides[i]
      return Math.abs(s.end[1] - s.start[1]) < 1 && s.start[1] > 5000
    })
    expect(top).toBeDefined()
    expect(top!.segmentsMm[0]).toBeGreaterThan(12900)
    expect(top!.segmentsMm[0]).toBeLessThan(13100)

    const right = model.perimeterChains.find((_, i) => {
      const s = sides[i]
      return Math.abs(s.end[0] - s.start[0]) < 1 && s.start[0] > 10000
    })
    expect(right).toBeDefined()
    expect(right!.segmentsMm[0]).toBeGreaterThan(5300)
    expect(right!.segmentsMm[0]).toBeLessThan(5450)

    const left = model.perimeterChains.find((_, i) => {
      const s = sides[i]
      return Math.abs(s.end[0] - s.start[0]) < 1 && s.start[0] < 1
    })
    expect(left).toBeDefined()
    expect(left!.segmentsMm[0]).toBeGreaterThan(9900)
    expect(left!.segmentsMm[0]).toBeLessThan(10100)
  })

  it('Max formula: L_outer=6000, w=70, n=4 → 1140 mm per section; w=40 → 1152', () => {
    expect(computeMaxEqualPurlinClearGapMm(6000, 70, 4)).toBeCloseTo(1140, 3)
    expect(computeMaxEqualPurlinClearGapMm(6000, 40, 4)).toBeCloseTo(1152, 3)
  })

  it('Midot 8000 / 5×40 dividers / 40 ends: auto clears all equal 7720/6', () => {
    const outerLengthMm = 8000
    const beamW = 40
    const contour: Point2D[] = [[0, 0], [8000, 0], [8000, 3000], [0, 3000]]
    const range = contourRangeAlongLamellaDir(contour, 0)
    const dividers = resolvePurlinPositionsMm({
      rangeMinMm: range.minMm,
      rangeMaxMm: range.maxMm,
      maxSpanMm: 1500,
      endBeamPlanWidthMm: beamW,
    })
    expect(dividers).toHaveLength(5)
    const expected = computeMaxEqualPurlinClearGapMm(outerLengthMm, beamW, 5)
    expect(expected).toBeCloseTo(7720 / 6, 6)
    const gaps = computePurlinClearGapsMm({
      rangeMinMm: range.minMm,
      rangeMaxMm: range.maxMm,
      beamWidthMm: beamW,
      dividerWidthMm: PURLIN_DIVIDER_CLEARANCE_WIDTH_MM,
      dividerPositions: dividers,
    })
    expect(gaps).toHaveLength(6)
    for (const g of gaps) expect(g).toBeCloseTo(expected, 6)
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(0.001)
  })

  it('double-T 70 mm ends + 5×40 dividers on 8000: all 6 clears = (8000−140−200)/6', () => {
    const contour: Point2D[] = [
      [0, 0],
      [4000, 0],
      [4000, 3000],
      [-4000, 3000],
      [-4000, -3000],
      [0, -3000],
    ]
    expect(profilePlanWidthMm(PERGOLA_CONSTRUCTION_PROFILES, 'R242')).toBe(70)
    expect(PURLIN_DIVIDER_CLEARANCE_WIDTH_MM).toBe(40)
    const params = {
      ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      beamProfileId: 'R242',
      measuredOuterLengthMmByEdgeIndex: [4000, 3000, 8000, 6000, 4000, 3000],
    }
    const dividers = resolvePlanPurlinLines(contour, params, PERGOLA_CONSTRUCTION_PROFILES)
    expect(dividers).toHaveLength(5)
    const expected = computeMaxEqualPurlinClearGapMm(8000, 70, 5)
    expect(expected).toBeCloseTo(7660 / 6, 6)
    expect(expected).not.toBeCloseTo(7720 / 6, 1)

    const spec = {
      ...baseSpec(contour),
      beamProfileId: 'R242',
      postProfileId: 'f8080',
      lamellaProfileId: 'f7020',
      purlinProfileId: 'purlin-led-6040',
    }
    const frame = computeFrame(spec, PERGOLA_CONSTRUCTION_PROFILES)
    const sides = beamsToGeometricSides(frame.beams)
    const model = buildTopPlanDimensionModel({
      geometricSides: sides,
      beams: frame.beams,
      profiles: PERGOLA_CONSTRUCTION_PROFILES,
      beamProfileId: 'R242',
      centroid: centroidOf(contour),
      contourVertices: contour,
      lamellaDirectionDeg: 0,
      dividerPositions: dividers,
      measuredOuterLengthMmByEdgeIndex: params.measuredOuterLengthMmByEdgeIndex,
      purlinClearLayoutVersion: 1,
    })
    expect(model.purlinClearChain).not.toBeNull()
    expect(model.purlinClearChain!.segmentsMm).toHaveLength(6)
    for (const g of model.purlinClearChain!.segmentsMm) {
      expect(g).toBeCloseTo(expected, 6)
    }
    expect(model.purlinClearDisplaySummary?.sectionClearLabel).toBe('1276.7')
    expect(model.purlinClearDisplaySummary?.sectionCount).toBe(6)
    expect(model.purlinClearDisplaySummary?.sectionClearMm).toBeCloseTo(expected, 6)
    expect(model.purlinClearVerification?.endBeamPlanWidthMm).toBe(70)
    expect(model.purlinClearVerification?.matchesMaxFormula).toBe(true)
  })

  describe('divider mode vs the printed clear chain (typed outers + layout v1)', () => {
    const contour: Point2D[] = [
      [0, 0],
      [4000, 0],
      [4000, 3000],
      [-4000, 3000],
      [-4000, -3000],
      [0, -3000],
    ]
    const measured = [4000, 3000, 8000, 6000, 4000, 3000]
    const params = {
      ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      beamProfileId: 'R242',
      measuredOuterLengthMmByEdgeIndex: measured,
    }
    const autoDividers = resolvePlanPurlinLines(contour, params, PERGOLA_CONSTRUCTION_PROFILES)

    function chainFor(
      dividers: typeof autoDividers,
      purlinDividerMode: 'auto' | 'manual' | undefined,
    ) {
      const spec = {
        ...baseSpec(contour),
        beamProfileId: 'R242',
        postProfileId: 'f8080',
        lamellaProfileId: 'f7020',
        purlinProfileId: 'purlin-led-6040',
      }
      const frame = computeFrame(spec, PERGOLA_CONSTRUCTION_PROFILES)
      return buildTopPlanDimensionModel({
        geometricSides: beamsToGeometricSides(frame.beams),
        beams: frame.beams,
        profiles: PERGOLA_CONSTRUCTION_PROFILES,
        beamProfileId: 'R242',
        centroid: centroidOf(contour),
        contourVertices: contour,
        lamellaDirectionDeg: 0,
        dividerPositions: dividers,
        measuredOuterLengthMmByEdgeIndex: measured,
        purlinClearLayoutVersion: 1,
        ...(purlinDividerMode ? { purlinDividerMode } : {}),
      })
    }

    // One divider moved by 100 mm: the two bays next to it are 100 mm apart from the rest.
    const movedDividers = autoDividers.map((d, i) => (i === 2 ? { ...d, positionMm: d.positionMm + 100 } : d))

    it('auto mode (and callers that do not pass the mode) still print the equal clear', () => {
      const equal = computeMaxEqualPurlinClearGapMm(8000, 70, 5)
      for (const mode of ['auto', undefined] as const) {
        const model = chainFor(autoDividers, mode)
        expect(model.purlinClearChain!.segmentsMm).toHaveLength(6)
        for (const g of model.purlinClearChain!.segmentsMm) expect(g).toBeCloseTo(equal, 6)
        expect(model.purlinClearDisplaySummary?.sectionClearLabel).toBe('1276.7')
      }
    })

    it('manual mode prints the real clear of every bay, not the equal one', () => {
      const equal = computeMaxEqualPurlinClearGapMm(8000, 70, 5)
      const model = chainFor(movedDividers, 'manual')
      const gaps = model.purlinClearChain!.segmentsMm
      expect(gaps).toHaveLength(6)
      expect(gaps[2]).toBeCloseTo(equal + 100, 6)
      expect(gaps[3]).toBeCloseTo(equal - 100, 6)
      for (const i of [0, 1, 4, 5]) expect(gaps[i]).toBeCloseTo(equal, 6)
      // Different gaps: no single "section clear" label.
      expect(model.purlinClearDisplaySummary).toBeNull()
    })

    it('manual mode with the same positions as auto prints the same chain as auto', () => {
      const auto = chainFor(autoDividers, 'auto').purlinClearChain!.segmentsMm
      const manual = chainFor(autoDividers, 'manual').purlinClearChain!.segmentsMm
      expect(manual).toHaveLength(auto.length)
      manual.forEach((g, i) => expect(g).toBeCloseTo(auto[i], 6))
    })

    it('auto mode ignores moved positions (the chain stays equal), as before', () => {
      const equal = computeMaxEqualPurlinClearGapMm(8000, 70, 5)
      for (const g of chainFor(movedDividers, 'auto').purlinClearChain!.segmentsMm) {
        expect(g).toBeCloseTo(equal, 6)
      }
    })
  })

  it('frozen 40 mm divider axes keep middle clears; beam change patch re-equalizes to 70 mm', () => {
    const contour: Point2D[] = [
      [0, 0],
      [4000, 0],
      [4000, 3000],
      [-4000, 3000],
      [-4000, -3000],
      [0, -3000],
    ]
    const measured = [4000, 3000, 8000, 6000, 4000, 3000]
    const from40 = resolvePlanPurlinLines(
      contour,
      {
        ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
        beamProfileId: 'f10040',
        measuredOuterLengthMmByEdgeIndex: measured,
      },
      PERGOLA_CONSTRUCTION_PROFILES,
    )
    const stuckOn70 = resolvePlanPurlinLines(
      contour,
      {
        ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
        beamProfileId: 'R242',
        measuredOuterLengthMmByEdgeIndex: measured,
        purlinDividers: { mode: 'manual', lines: from40 },
      },
      PERGOLA_CONSTRUCTION_PROFILES,
    )
    const stuckGaps = computePurlinClearGapsMm({
      rangeMinMm: -4000,
      rangeMaxMm: 4000,
      beamWidthMm: 70,
      dividerWidthMm: PURLIN_DIVIDER_CLEARANCE_WIDTH_MM,
      dividerPositions: stuckOn70,
    })
    expect(stuckGaps.slice(1, 5).every((g) => Math.abs(g - 7720 / 6) < 0.01)).toBe(true)
    expect(stuckGaps[0]).toBeCloseTo(7720 / 6 - 30, 6)
    expect(stuckGaps[5]).toBeCloseTo(7720 / 6 - 30, 6)

    const reset = {
      ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      ...beamProfileChangePatch('R242'),
      measuredOuterLengthMmByEdgeIndex: measured,
    }
    expect(reset.purlinDividers.mode).toBe('auto')
    const fresh = resolvePlanPurlinLines(contour, reset, PERGOLA_CONSTRUCTION_PROFILES)
    const expected = computeMaxEqualPurlinClearGapMm(8000, 70, 5)
    expect(expected).toBeCloseTo(7660 / 6, 6)
    const freshGaps = computePurlinClearGapsMm({
      rangeMinMm: -4000,
      rangeMaxMm: 4000,
      beamWidthMm: 70,
      dividerWidthMm: PURLIN_DIVIDER_CLEARANCE_WIDTH_MM,
      dividerPositions: fresh,
    })
    for (const gap of freshGaps) expect(gap).toBeCloseTo(expected, 6)
  })

  it('dimension chain shows actual clears that match Max formula when placed equally', () => {
    const outerLengthMm = 6000
    const beamW = 70
    const n = 4
    const contour: Point2D[] = [[0, 0], [6000, 0], [6000, 3000], [0, 3000]]
    const dividers = dividerPositionsForMaxEqualClears({
      rangeMinMm: 0,
      rangeMaxMm: 6000,
      outerLengthMm,
      endBeamPlanWidthMm: beamW,
      dividerCount: n,
    })
    expect(dividers).toHaveLength(4)
    const gaps = computePurlinClearGapsMm({
      rangeMinMm: 0,
      rangeMaxMm: 6000,
      beamWidthMm: beamW,
      dividerWidthMm: PURLIN_DIVIDER_CLEARANCE_WIDTH_MM,
      dividerPositions: dividers,
    })
    expect(gaps).toHaveLength(5)
    for (const g of gaps) expect(g).toBeCloseTo(1140, 0)

    const spec = baseSpec(contour)
    const frame = computeFrame(spec, PROFILES)
    const sides = beamsToGeometricSides(frame.beams)
    const perimeterChains = buildTopPlanDimensionModel({
      geometricSides: sides,
      beams: frame.beams,
      profiles: PROFILES,
      beamProfileId: 'beam-1',
      centroid: centroidOf(contour),
      contourVertices: contour,
      lamellaDirectionDeg: 0,
      dividerPositions: dividers,
    }).perimeterChains
    const chain = buildPurlinClearDimensionChain({
      geometricSides: sides,
      perimeterChains,
      lamellaDirectionDeg: 0,
      beamWidthMm: beamW,
      dividerWidthMm: PURLIN_DIVIDER_CLEARANCE_WIDTH_MM,
      dividerPositions: dividers,
      centroid: centroidOf(contour),
    })
    expect(chain!.segmentsMm).toHaveLength(5)
    for (const s of chain!.segmentsMm) expect(s).toBeCloseTo(1140, 0)

    const check = verifyPurlinClearsAgainstMaxRule({
      gapsMm: gaps,
      outerLengthMm,
      endBeamPlanWidthMm: beamW,
    })
    expect(check!.matchesMaxFormula).toBe(true)
    expect(check!.gapsAreUniform).toBe(true)

    expect(
      buildTopPlanDimensionModel({
        geometricSides: sides,
        beams: frame.beams,
        profiles: PROFILES,
        beamProfileId: 'beam-1',
        centroid: centroidOf(contour),
        contourVertices: contour,
        lamellaDirectionDeg: 0,
        dividerPositions: dividers,
      }).purlinClearChain,
    ).not.toBeNull()
  })

  it('purlin clear gaps: one value per adjacent pair (n dividers → n+1 gaps)', () => {
    const gaps = computePurlinClearGapsMm({
      rangeMinMm: 0,
      rangeMaxMm: 6000,
      beamWidthMm: 40,
      dividerWidthMm: PURLIN_DIVIDER_CLEARANCE_WIDTH_MM,
      dividerPositions: [
        { id: 'div-1', positionMm: 2000 },
        { id: 'div-2', positionMm: 4000 },
      ],
    })
    expect(gaps).toHaveLength(3)
    expect(gaps[1]).toBeCloseTo(2000 - PURLIN_DIVIDER_CLEARANCE_WIDTH_MM, 3)
  })

  it('consistency: sum(clears)+n×divider+2×beam ≈ outer side (rectangle)', () => {
    const contour: Point2D[] = [[0, 0], [6000, 0], [6000, 3000], [0, 3000]]
    const spec = baseSpec(contour)
    const frame = computeFrame(spec, PROFILES)
    const beams = frame.beams
    const sides = beamsToGeometricSides(beams)
    const range = contourRangeAlongLamellaDir(contour, 0)
    const dividers = resolvePurlinPositionsMm({
      rangeMinMm: range.minMm,
      rangeMaxMm: range.maxMm,
      maxSpanMm: LAM.maxLamellaSpanMm,
    })
    const model = buildTopPlanDimensionModel({
      geometricSides: sides,
      beams,
      profiles: PROFILES,
      beamProfileId: 'beam-1',
      centroid: centroidOf(contour),
      contourVertices: contour,
      lamellaDirectionDeg: 0,
      dividerPositions: dividers,
    })
    expect(dividers.length).toBeGreaterThan(0)
    const beamW = profilePlanWidthMm(PROFILES, 'beam-1')
    const divW = PURLIN_DIVIDER_CLEARANCE_WIDTH_MM
    const checks = verifyPurlinClearSpanConsistency({
      sides,
      beams,
      profiles: PROFILES,
      perimeterChains: model.perimeterChains,
      lamellaDirectionDeg: 0,
      beamWidthMm: beamW,
      dividerWidthMm: divW,
      dividerPositions: dividers,
    })
    expect(checks.length).toBeGreaterThan(0)
    expect(checks.every((c) => c.ok)).toBe(true)
  })

  it('plan width uses min(section), not first catalog digit', () => {
    expect(parseCatalogNameDims('מלבן 40/120/1.8', 'beam')).toMatchObject({ widthMm: 40, heightMm: 120 })
    expect(profilePlanWidthMm(PROFILES, 'beam-1')).toBe(40)
    expect(profilePlanWidthMm(PROFILES, 'beam-120-40')).toBe(40)
  })

  it('changing beam plan width 40→70 shifts outer side and end clears by 2×30 mm', () => {
    const BEAM_70: ProfileDimensions = {
      widthMm: 70,
      heightMm: 120,
      maxSpanMm: 6000,
      planWidthMm: 70,
      planWidthSource: 'override-70',
    }
    const profiles70 = new Map(PROFILES)
    profiles70.set('beam-70', BEAM_70)
    const contour: Point2D[] = [[0, 0], [6000, 0], [6000, 3000], [0, 3000]]
    const frame40 = computeFrame(baseSpec(contour), PROFILES)
    const frame70 = computeFrame({ ...baseSpec(contour), beamProfileId: 'beam-70' }, profiles70)
    const sides40 = beamsToGeometricSides(frame40.beams)
    const sides70 = beamsToGeometricSides(frame70.beams)
    const c = centroidOf(contour)
    const bottomSide40 = sides40.find(
      (s) => Math.abs(s.start[1]) < 1 && Math.abs(s.end[1]) < 1 && Math.abs(s.end[0] - s.start[0]) > 5000,
    )!
    const bottomSide70 = sides70.find(
      (s) => Math.abs(s.start[1]) < 1 && Math.abs(s.end[1]) < 1 && Math.abs(s.end[0] - s.start[0]) > 5000,
    )!
    const bottom40 = buildOuterPerimeterDimensionChains(sides40, frame40.beams, 40, c, (b) =>
      profilePlanWidthMm(PROFILES, b.profileId),
    ).find((ch) => ch.beamId === bottomSide40.id)!
    const bottom70 = buildOuterPerimeterDimensionChains(sides70, frame70.beams, 70, c, (b) =>
      profilePlanWidthMm(profiles70, b.profileId),
    ).find((ch) => ch.beamId === bottomSide70.id)!
    expect(bottom70.segmentsMm[0] - bottom40.segmentsMm[0]).toBeCloseTo(30, 0)

    const range = contourRangeAlongLamellaDir(contour, 0)
    const dividers = [{ id: 'div-1', positionMm: 3000 }]
    const gaps40 = computePurlinClearGapsMm({
      rangeMinMm: range.minMm,
      rangeMaxMm: range.maxMm,
      beamWidthMm: 40,
      dividerWidthMm: PURLIN_DIVIDER_CLEARANCE_WIDTH_MM,
      dividerPositions: dividers,
    })
    const gaps70 = computePurlinClearGapsMm({
      rangeMinMm: range.minMm,
      rangeMaxMm: range.maxMm,
      beamWidthMm: 70,
      dividerWidthMm: PURLIN_DIVIDER_CLEARANCE_WIDTH_MM,
      dividerPositions: dividers,
    })
    expect(gaps40[0] - gaps70[0]).toBeCloseTo(30, 0)
    expect(gaps40[1] - gaps70[1]).toBeCloseTo(30, 0)
  })

  it('diagonal side: outer length is not naive axis+planWidth', () => {
    const contour = [...G_SLOPE_FIXTURE]
    const frame40 = computeFrame(baseSpec(contour), PROFILES)
    const sides40 = beamsToGeometricSides(frame40.beams)
    const c = centroidOf(contour)
    const isDiagonal = (s: { start: Point2D; end: Point2D }) => {
      const dx = Math.abs(s.end[0] - s.start[0])
      const dy = Math.abs(s.end[1] - s.start[1])
      return dx > 500 && dy > 500
    }
    const idx = sides40.findIndex(isDiagonal)
    const outer40 = outerFaceLengthOnSide(sides40[idx], frame40.beams, 40, c, (b) =>
      profilePlanWidthMm(PROFILES, b.profileId),
    ).lengthMm
    const axisLen = Math.hypot(
      sides40[idx].end[0] - sides40[idx].start[0],
      sides40[idx].end[1] - sides40[idx].start[1],
    )
    expect(outer40).not.toBeCloseTo(axisLen + 40, 0)
  })

  const MIDOT_CONTOUR: Point2D[] = [
    [0, 0],
    [4000, 0],
    [4000, 3000],
    [-4000, 3000],
    [-4000, -3000],
    [0, -3000],
  ]
  const MIDOT_MEASURED = [4000, 3000, 8000, 6000, 4000, 3000]

  it('midot measured lengths are the drawing labels (0 mm tolerance)', () => {
    const spec = baseSpec(MIDOT_CONTOUR)
    const frame = computeFrame(spec, PROFILES)
    const sides = beamsToGeometricSides(frame.beams)
    const model = buildTopPlanDimensionModel({
      geometricSides: sides,
      beams: frame.beams,
      profiles: PROFILES,
      beamProfileId: 'beam-1',
      centroid: centroidOf(MIDOT_CONTOUR),
      contourVertices: MIDOT_CONTOUR,
      lamellaDirectionDeg: 0,
      dividerPositions: [],
      measuredOuterLengthMmByEdgeIndex: MIDOT_MEASURED,
    })
    const labels = MIDOT_CONTOUR.map((_, i) => {
      const sideIdx = sides.findIndex((s) => matchContourEdgeIndex(s, MIDOT_CONTOUR) === i)
      return model.perimeterChains[sideIdx]?.segmentsMm[0]
    })
    expect(labels).toEqual(MIDOT_MEASURED)
    expect(labels.some((n) => n === 8080 || n === 6080 || n === 4080 || n === 3080)).toBe(false)
  })

  it('L-shape without measured: outer = axis ± w/2 at ends (square and oblique)', () => {
    const lContour: Point2D[] = [
      [0, 0],
      [4000, 0],
      [4000, 2000],
      [2000, 2000],
      [2000, 4000],
      [0, 4000],
    ]
    const spec = baseSpec(lContour)
    const frame = computeFrame(spec, PROFILES)
    const sides = beamsToGeometricSides(frame.beams)
    const model = buildTopPlanDimensionModel({
      geometricSides: sides,
      beams: frame.beams,
      profiles: PROFILES,
      beamProfileId: 'beam-1',
      centroid: centroidOf(lContour),
      contourVertices: lContour,
      lamellaDirectionDeg: 0,
      dividerPositions: [],
    })
    for (let i = 0; i < sides.length; i++) {
      const axis = Math.hypot(sides[i].end[0] - sides[i].start[0], sides[i].end[1] - sides[i].start[1])
      const label = model.perimeterChains[i].segmentsMm[0]
      expect(label).not.toBeCloseTo(axis + 80, 0)
      expect(Math.abs(label - axis)).toBeLessThanOrEqual(40 + 0.5)
    }

    const slope = [...G_SLOPE_FIXTURE]
    const frameS = computeFrame(baseSpec(slope), PROFILES)
    const sidesS = beamsToGeometricSides(frameS.beams)
    const modelS = buildTopPlanDimensionModel({
      geometricSides: sidesS,
      beams: frameS.beams,
      profiles: PROFILES,
      beamProfileId: 'beam-1',
      centroid: centroidOf(slope),
      contourVertices: slope,
      lamellaDirectionDeg: 0,
      dividerPositions: [],
    })
    const diag = sidesS.findIndex((s) => {
      const dx = Math.abs(s.end[0] - s.start[0])
      const dy = Math.abs(s.end[1] - s.start[1])
      return dx > 500 && dy > 500
    })
    const axisDiag = Math.hypot(
      sidesS[diag].end[0] - sidesS[diag].start[0],
      sidesS[diag].end[1] - sidesS[diag].start[1],
    )
    const labelDiag = modelS.perimeterChains[diag].segmentsMm[0]
    expect(labelDiag).not.toBeCloseTo(axisDiag + 40, 0)
    expect(labelDiag).not.toBeCloseTo(axisDiag + 80, 0)
    expect(Math.abs(labelDiag - axisDiag)).toBeGreaterThan(1)
    expect(Math.abs(labelDiag - axisDiag)).toBeLessThan(80)
  })
})

describe('L-shape 12000 outer / 8 dividers — where 44 mm is lost', () => {
  const L_AXIS: Point2D[] = [
    [0, 0],
    [4000, 0],
    [4000, 3000],
    [11960, 3000],
    [11960, 6460],
    [0, 6460],
  ]
  const MEASURED = [4000, 3000, 8000, 3500, 12000, 6500]

  it('legacy full-width inset on axis 11960 prints 1284; missing 40 mm is 20+20 from centerline', () => {
    const params = {
      ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      beamProfileId: 'f10040',
    }
    delete (params as { purlinClearLayoutVersion?: number }).purlinClearLayoutVersion
    delete (params as { measuredOuterLengthMmByEdgeIndex?: unknown }).measuredOuterLengthMmByEdgeIndex
    const dividers = resolvePlanPurlinLines(L_AXIS, params, PERGOLA_CONSTRUCTION_PROFILES)
    const spec = {
      ...baseSpec(L_AXIS),
      beamProfileId: 'f10040',
      postProfileId: 'f8080',
      lamellaProfileId: 'f7020',
      purlinProfileId: 'purlin-led-6040',
    }
    const frame = computeFrame(spec, PERGOLA_CONSTRUCTION_PROFILES)
    const sides = beamsToGeometricSides(frame.beams)
    const model = buildTopPlanDimensionModel({
      geometricSides: sides,
      beams: frame.beams,
      profiles: PERGOLA_CONSTRUCTION_PROFILES,
      beamProfileId: 'f10040',
      centroid: centroidOf(L_AXIS),
      contourVertices: L_AXIS,
      lamellaDirectionDeg: 0,
      dividerPositions: dividers,
      measuredOuterLengthMmByEdgeIndex: MEASURED,
    })
    const dump = diagnosePurlinClearsOnPrimarySide({
      geometricSides: sides,
      perimeterChains: model.perimeterChains,
      lamellaDirectionDeg: 0,
      dividerPositions: dividers,
      beamWidthMm: 40,
      beamProfileId: 'f10040',
      endInsetMm: 40,
    })
    expect(dump).not.toBeNull()
    expect(dump!.outerLengthMm).toBe(12000)
    expect(dump!.leftEndWidthMm).toBe(40)
    expect(dump!.rightEndWidthMm).toBe(40)
    expect(dump!.dividerWidthMm).toBe(40)
    expect(dump!.dividerCount).toBe(8)
    expect(dump!.axisLengthMm).toBeCloseTo(11960, 0)
    expect(dump!.endInsetMm).toBe(40)
    expect(dump!.formulaClearMm).toBeCloseTo(11600 / 9, 6)
    expect(formatPurlinClearLabelMm(dump!.formulaClearMm)).toBe('1288.9')
    for (const g of dump!.measuredClearsMm) expect(g).toBeCloseTo(11560 / 9, 5)
    expect(dump!.extraVsFormulaSumMm).toBeCloseTo(-40, 0)
  })

  it('v1: 12000 / 8×40 / frame 40 → 1288.9; 6000 / 4×40 / double-T 70 → 1140.0', () => {
    const params = {
      ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      beamProfileId: 'f10040',
      measuredOuterLengthMmByEdgeIndex: MEASURED,
      purlinClearLayoutVersion: 1 as const,
    }
    const dividers = resolvePlanPurlinLines(L_AXIS, params, PERGOLA_CONSTRUCTION_PROFILES)
    expect(dividers).toHaveLength(8)
    const spec = {
      ...baseSpec(L_AXIS),
      beamProfileId: 'f10040',
      postProfileId: 'f8080',
      lamellaProfileId: 'f7020',
      purlinProfileId: 'purlin-led-6040',
    }
    const frame = computeFrame(spec, PERGOLA_CONSTRUCTION_PROFILES)
    const sides = beamsToGeometricSides(frame.beams)
    const model = buildTopPlanDimensionModel({
      geometricSides: sides,
      beams: frame.beams,
      profiles: PERGOLA_CONSTRUCTION_PROFILES,
      beamProfileId: 'f10040',
      centroid: centroidOf(L_AXIS),
      contourVertices: L_AXIS,
      lamellaDirectionDeg: 0,
      dividerPositions: dividers,
      measuredOuterLengthMmByEdgeIndex: MEASURED,
      purlinClearLayoutVersion: 1,
    })
    expect(model.purlinClearDisplaySummary?.sectionClearLabel).toBe('1288.9')
    expect(model.purlinClearDisplaySummary?.sectionCount).toBe(9)
    expect(model.purlinClearDisplaySummary?.sectionClearMm).toBeCloseTo(11600 / 9, 6)

    expect(computeEqualPurlinClearMm({
      outerLengthMm: 6000,
      leftEndWidthMm: 70,
      rightEndWidthMm: 70,
      dividerCount: 4,
    })).toBe(1140)
    expect(formatPurlinClearLabelMm(1140)).toBe('1140.0')
  })

  it('full row: all 9 clears = 1288.9 and inner sum = 11600 − 8×40 (not leftover 1248.9)', () => {
    const params = {
      ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      beamProfileId: 'f10040',
      measuredOuterLengthMmByEdgeIndex: MEASURED,
      purlinClearLayoutVersion: 1 as const,
    }
    const dividers = resolvePlanPurlinLines(L_AXIS, params, PERGOLA_CONSTRUCTION_PROFILES)
    expect(dividers).toHaveLength(8)
    const range = contourRangeAlongLamellaDir(L_AXIS, 0)
    const axisLengthMm = range.maxMm - range.minMm
    const endInsetMm = resolvePurlinEndInsetMm({
      axisLengthMm,
      outerLengthMm: 12000,
      endWidthMm: 40,
      layoutVersion: 1,
      outerIsExplicit: true,
    })
    expect(endInsetMm).toBe(20)
    const expectedClear = computeEqualPurlinClearMm({
      outerLengthMm: 12000,
      leftEndWidthMm: 40,
      rightEndWidthMm: 40,
      dividerCount: 8,
    })
    expect(formatPurlinClearLabelMm(expectedClear)).toBe('1288.9')
    expect(9 * expectedClear).toBeCloseTo(11600, 6)
    expect(12000 - 80 - 8 * 40).toBe(11600)

    const gaps = computePurlinClearGapsMm({
      rangeMinMm: range.minMm,
      rangeMaxMm: range.maxMm,
      beamWidthMm: 40,
      dividerWidthMm: 40,
      dividerPositions: dividers,
      endInsetMm,
    })
    expect(gaps).toHaveLength(9)
    for (const gap of gaps) {
      expect(gap).toBeCloseTo(expectedClear, 5)
      expect(formatPurlinClearLabelMm(gap)).toBe('1288.9')
    }
    const sumClears = gaps.reduce((a, b) => a + b, 0)
    expect(sumClears).toBeCloseTo(12000 - 80 - 8 * 40, 5)
    expect(sumClears).toBeCloseTo(9 * expectedClear, 5)
    const innerFaceSpanMm = range.maxMm - range.minMm - 2 * endInsetMm
    expect(innerFaceSpanMm).toBeCloseTo(sumClears + 8 * 40, 5)
    expect(gaps[gaps.length - 1]).not.toBeCloseTo(1248.9, 0)

    const spec = {
      ...baseSpec(L_AXIS),
      beamProfileId: 'f10040',
      postProfileId: 'f8080',
      lamellaProfileId: 'f7020',
      purlinProfileId: 'purlin-led-6040',
    }
    const frame = computeFrame(spec, PERGOLA_CONSTRUCTION_PROFILES)
    const sides = beamsToGeometricSides(frame.beams)
    const model = buildTopPlanDimensionModel({
      geometricSides: sides,
      beams: frame.beams,
      profiles: PERGOLA_CONSTRUCTION_PROFILES,
      beamProfileId: 'f10040',
      centroid: centroidOf(L_AXIS),
      contourVertices: L_AXIS,
      lamellaDirectionDeg: 0,
      dividerPositions: dividers,
      measuredOuterLengthMmByEdgeIndex: MEASURED,
      purlinClearLayoutVersion: 1,
    })
    const chain = model.purlinClearChain
    expect(chain).not.toBeNull()
    expect(chain!.segmentsMm).toHaveLength(9)
    for (const seg of chain!.segmentsMm) {
      expect(seg).toBeCloseTo(expectedClear, 5)
      expect(formatPurlinClearLabelMm(seg)).toBe('1288.9')
    }
    const pointGaps = chain!.points.slice(1).map((p, i) => p.distanceFromStartMm - chain!.points[i].distanceFromStartMm)
    expect(pointGaps).toHaveLength(9)
    for (const gap of pointGaps) expect(gap).toBeCloseTo(expectedClear, 5)
    expect(pointGaps.reduce((a, b) => a + b, 0)).toBeCloseTo(11600, 5)
    expect(pointGaps[8]).not.toBeCloseTo(1248.9, 0)
  })
})
