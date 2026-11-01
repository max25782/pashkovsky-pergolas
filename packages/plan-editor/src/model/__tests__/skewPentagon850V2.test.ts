import { describe, expect, it } from 'vitest'
import {
  buildPieces,
  buildPlanEditorOverlayModel,
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  outerVertexAtContourIndex,
  PERGOLA_CONSTRUCTION_PROFILES,
  pieceAxis,
  polygonAreaM2,
  specFromPlan,
  WING_SHELF_SPAN_DIVIDER_ID,
} from '@pashkovsky/pergola-core'
import type { CutPiece, Point2D } from '@pashkovsky/pergola-core'
import {
  applyStraightBeam,
  pentagonV2Contour,
  pentagonV2PlanParams,
  SKEW_PENTAGON_850_V2_ID,
  V2_BEAM,
  V2_CENTERLINE_TARGET_MM,
  V2_CROSSBEAM_CENTRES_Y_MM,
  V2_CROSSBEAM_END_EDGE_INDEX,
  V2_CROSSBEAM_FACES_Y_MM,
  V2_CROSSBEAM_PROFILE_ID,
  V2_EXPECTED_CLEAR_GAPS_MM,
  V2_EXPECTED_CROSSBEAM_OUTER_MM,
  V2_EXPECTED_SPLIT_OUTER_MM,
  V2_LENGTH_TOLERANCE_MM,
  V2_MIRROR_X_MM,
  V2_OUTER_AREA_M2,
  V2_OUTER_TARGET_MM,
  V2_SIDE_TOLERANCE_MM,
  V2_TYPED_OUTER_MM,
  verticalHitOnOffsetEdge,
} from './fixtures/skew-pentagon-850-2026-11-01-v2'

const FRAME_HALF_MM = 20
const EXPECTED_SIDES_MM = [900, 8500, 2300, 6328, 9809]
const EXPECTED_ANGLES_DEG = [90, 126, 153.9, 86.1, 84.0]
const profiles = PERGOLA_CONSTRUCTION_PROFILES

const asObjects = (c: Point2D[]) => c.map((p) => ({ x: p[0], y: p[1] }))
const sideLengths = (c: Point2D[]) =>
  c.map((p, i) => {
    const q = c[(i + 1) % c.length]
    return Math.hypot(q[0] - p[0], q[1] - p[1])
  })
/** Real outer face: every side moved outward by half the frame beam, corners mitred. */
const outerFaceOf = (centerline: Point2D[]) =>
  centerline.map((_, i) => outerVertexAtContourIndex(centerline, i, FRAME_HALF_MM, FRAME_HALF_MM))

function interiorAnglesDeg(poly: Point2D[]): number[] {
  return poly.map((p, i) => {
    const prev = poly[(i + poly.length - 1) % poly.length]
    const next = poly[(i + 1) % poly.length]
    const a: Point2D = [p[0] - prev[0], p[1] - prev[1]]
    const b: Point2D = [next[0] - p[0], next[1] - p[1]]
    const turn = Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1])
    return 180 - Math.abs((turn * 180) / Math.PI)
  })
}

/** Length of the chord a horizontal line y = yMm cuts out of a convex polygon. */
function chordAtY(poly: Point2D[], yMm: number): number {
  const xs: number[] = []
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length]
    if ((a[1] - yMm) * (b[1] - yMm) > 0 || a[1] === b[1]) return
    const t = (yMm - a[1]) / (b[1] - a[1])
    xs.push(a[0] + t * (b[0] - a[0]))
  })
  return Math.max(...xs) - Math.min(...xs)
}

function pointInPolygon(p: Point2D, poly: Point2D[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

type PlanParams = Parameters<typeof specFromPlan>[0]['params']

function planFor(mirror: boolean, params: PlanParams = pentagonV2PlanParams(DEFAULT_PLAN_CONSTRUCTION_PARAMS)) {
  const contour = pentagonV2Contour(mirror)
  const spec = specFromPlan({ contour, wallEdgeIndices: [], params })
  const built = buildPieces(spec, profiles)
  return { contour, params, spec, built }
}

const purlinRows = (pieces: CutPiece[]) =>
  pieces.filter((p) => p.role === 'purlin' && p.dividerId !== WING_SHELF_SPAN_DIVIDER_ID)

describe.each([
  ['mirrored plan as shown in the editor (clockwise)', true],
  ['drawing frame (counter-clockwise, diagnostic)', false],
] as const)(`${SKEW_PENTAGON_850_V2_ID}: %s`, (_label, mirror) => {
  const { contour, built } = planFor(mirror)
  const outer = outerFaceOf(contour)

  it('contour is unchanged: five outer sides within 0.05 cm, angles within 0.1 deg', () => {
    sideLengths(outer).forEach((len, i) => {
      expect(Math.abs(len - EXPECTED_SIDES_MM[i])).toBeLessThanOrEqual(V2_SIDE_TOLERANCE_MM)
    })
    interiorAnglesDeg(outer).forEach((angle, i) => {
      expect(Math.abs(angle - EXPECTED_ANGLES_DEG[i])).toBeLessThanOrEqual(0.1)
    })
  })

  it('outer area is 39.27 m2 within 0.05; billed (centerline) area is 38.72 m2', () => {
    expect(Math.abs(polygonAreaM2(asObjects(outer)) - V2_OUTER_AREA_M2)).toBeLessThanOrEqual(0.05)
    expect(Math.round(polygonAreaM2(asObjects(contour)) * 100) / 100).toBe(38.72)
  })

  it('exactly seven crossbeams PA3022 at the explicit Y positions (within 1 mm), no auto shelf', () => {
    const rows = purlinRows(built.pieces)
    expect(rows).toHaveLength(7)
    expect(built.pieces.some((p) => p.dividerId === WING_SHELF_SPAN_DIVIDER_ID)).toBe(false)
    rows.forEach((piece, i) => {
      expect(piece.profileId).toBe(V2_CROSSBEAM_PROFILE_ID)
      expect(piece.dividerId).toBe(`row-${i + 1}`)
      expect(Math.abs(pieceAxis(piece).start[1] - V2_CROSSBEAM_CENTRES_Y_MM[i])).toBeLessThanOrEqual(V2_LENGTH_TOLERANCE_MM)
    })
  })

  it('crossbeam faces and clear gaps: 6 x 1212 and 1087 between L6 and L7', () => {
    const centres = V2_CROSSBEAM_CENTRES_Y_MM
    const faces = centres.map((c) => [c - 20, c + 20])
    faces.forEach(([lo, hi], i) => {
      expect(Math.abs(lo - V2_CROSSBEAM_FACES_Y_MM[i][0])).toBeLessThanOrEqual(V2_LENGTH_TOLERANCE_MM)
      expect(Math.abs(hi - V2_CROSSBEAM_FACES_Y_MM[i][1])).toBeLessThanOrEqual(V2_LENGTH_TOLERANCE_MM)
    })
    const abInner = contour[0][1] + FRAME_HALF_MM
    const gaps = [faces[0][0] - abInner, ...faces.slice(1).map(([lo], i) => lo - faces[i][1])]
    gaps.forEach((gap, i) => {
      expect(Math.abs(gap - V2_EXPECTED_CLEAR_GAPS_MM[i])).toBeLessThanOrEqual(V2_LENGTH_TOLERANCE_MM)
    })
  })

  it('last gap L7 -> frame DE at the EA inner face: tilted frame makes it 1085.5, not 1087 (within 2 mm)', () => {
    const centroid: Point2D = [
      contour.reduce((s, p) => s + p[0], 0) / contour.length,
      contour.reduce((s, p) => s + p[1], 0) / contour.length,
    ]
    const eaInnerX = mirror ? contour[4][0] - FRAME_HALF_MM : contour[4][0] + FRAME_HALF_MM
    const deInnerY = verticalHitOnOffsetEdge(contour[3], contour[4], centroid, FRAME_HALF_MM, eaInnerX)
    const gap = deInnerY - (V2_CROSSBEAM_CENTRES_Y_MM[6] + 20)
    expect(Math.abs(gap - 1085.5)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(gap - V2_EXPECTED_CLEAR_GAPS_MM[7])).toBeLessThanOrEqual(2)
  })

  it('outer length of L1..L7 (outer face EA to outer face of the contour) within 1 mm of the drawing', () => {
    V2_CROSSBEAM_CENTRES_Y_MM.forEach((y, i) => {
      expect(Math.abs(chordAtY(outer, y) - V2_EXPECTED_CROSSBEAM_OUTER_MM[i])).toBeLessThanOrEqual(V2_LENGTH_TOLERANCE_MM)
    })
  })

  it('program crossbeam length = outer length - 40 (EA frame) - frame thickness along the row at the far end', () => {
    const rows = purlinRows(built.pieces)
    rows.forEach((piece, i) => {
      const edge = V2_CROSSBEAM_END_EDGE_INDEX[i]
      const a = contour[edge]
      const b = contour[(edge + 1) % contour.length]
      const sinPhi = Math.abs(b[1] - a[1]) / Math.hypot(b[0] - a[0], b[1] - a[1])
      const expectedClear = V2_EXPECTED_CROSSBEAM_OUTER_MM[i] - 40 - 40 / sinPhi
      expect(Math.abs(piece.lengthAxisMm - expectedClear)).toBeLessThanOrEqual(V2_LENGTH_TOLERANCE_MM)
    })
  })

  it('every crossbeam part and the beam fit a PA3022 bar', () => {
    const stock = Math.max(...(profiles.get(V2_CROSSBEAM_PROFILE_ID)?.availableStockLengthsMm ?? [0]))
    expect(stock).toBeGreaterThan(0)
    const { pieces } = applyStraightBeam({ pieces: built.pieces, profiles, contour, mirror })
    pieces
      .filter((p) => p.role === 'purlin')
      .forEach((p) => expect(p.lengthLongMm, p.id).toBeLessThanOrEqual(stock))
  })

  describe('straight beam and the split of L6 / L7', () => {
    const result = applyStraightBeam({ pieces: built.pieces, profiles, contour, mirror })
    const xB = mirror ? V2_MIRROR_X_MM - V2_BEAM.axisFromEaOuterMm : V2_BEAM.axisFromEaOuterMm

    it('adds exactly one beam: PA3022, parallel to EA, axis 3104.1 from the outer face of EA, starts on the lower face of L5', () => {
      const beams = result.pieces.filter((p) => p.dividerId === WING_SHELF_SPAN_DIVIDER_ID)
      expect(beams).toHaveLength(1)
      expect(result.beam.profileId).toBe(V2_CROSSBEAM_PROFILE_ID)
      const { start, end } = pieceAxis(result.beam)
      expect(Math.abs(start[0] - xB)).toBeLessThanOrEqual(V2_LENGTH_TOLERANCE_MM)
      expect(Math.abs(end[0] - xB)).toBeLessThanOrEqual(V2_LENGTH_TOLERANCE_MM)
      expect(Math.abs(start[1] - V2_BEAM.startYMm)).toBeLessThanOrEqual(V2_LENGTH_TOLERANCE_MM)
      // L5 centre 6280 + 20 = 6300: the beam starts on its lower face.
      expect(Math.abs(start[1] - (V2_CROSSBEAM_CENTRES_Y_MM[4] + 20))).toBeLessThanOrEqual(V2_LENGTH_TOLERANCE_MM)
    })

    it('axis to the outer edge of DE is 3180.1 (within 1 mm); to the inner face of the frame it is shorter', () => {
      expect(Math.abs(result.attachment.endYOuterEdgeMm - V2_BEAM.endYOuterMm)).toBeLessThanOrEqual(V2_LENGTH_TOLERANCE_MM)
      expect(Math.abs(result.attachment.axisToOuterEdgeMm - V2_BEAM.axisLengthToOuterMm)).toBeLessThanOrEqual(V2_LENGTH_TOLERANCE_MM)
      expect(result.attachment.axisToInnerFaceMm).toBeCloseTo(3139.8, 0)
      expect(result.beam.lengthAxisMm).toBe(result.attachment.axisToInnerFaceMm)
      // DE is tilted 6.05 deg to the row direction, so the beam end is cut at that miter.
      expect(Math.abs(result.attachment.endCutMiterDeg - 6.05)).toBeLessThanOrEqual(0.1)
    })

    it('splits L6 and L7 only; L1..L5 are whole', () => {
      const dividers = new Set(result.parts.map((p) => p.dividerId))
      expect([...dividers].sort()).toEqual(['row-6', 'row-7'])
      const rows = purlinRows(result.pieces)
      expect(rows.filter((p) => !/-[ab]$/.test(p.id))).toHaveLength(5)
      expect(rows).toHaveLength(9)
    })

    it('parts of L6 and L7: outer halves 3104.1 / 2906.8 and 3104.1 / 3104.1 within 1 mm, clear lengths reported', () => {
      for (const row of ['row-6', 'row-7'] as const) {
        const centre = V2_CROSSBEAM_CENTRES_Y_MM[row === 'row-6' ? 5 : 6]
        const parts = purlinRows(result.pieces)
          .filter((p) => p.dividerId === row)
          .sort((a, b) => (mirror ? -1 : 1) * (pieceAxis(a).start[0] - pieceAxis(b).start[0]))
        expect(parts).toHaveLength(2)
        const edge = V2_CROSSBEAM_END_EDGE_INDEX[row === 'row-6' ? 5 : 6]
        const a = contour[edge]
        const b = contour[(edge + 1) % contour.length]
        const farFrameAlongRow = 40 / (Math.abs(b[1] - a[1]) / Math.hypot(b[0] - a[0], b[1] - a[1]))
        // EA side: EA frame 40 + clear + half of the beam. Other side: half beam + clear + frame along the row.
        const eaSideOuter = 40 + parts[0].lengthAxisMm + 20
        const farSideOuter = 20 + parts[1].lengthAxisMm + farFrameAlongRow
        expect(Math.abs(eaSideOuter - V2_EXPECTED_SPLIT_OUTER_MM[row][0])).toBeLessThanOrEqual(V2_LENGTH_TOLERANCE_MM)
        expect(Math.abs(farSideOuter - V2_EXPECTED_SPLIT_OUTER_MM[row][1])).toBeLessThanOrEqual(V2_LENGTH_TOLERANCE_MM)
        expect(Math.abs(pieceAxis(parts[0]).start[1] - centre)).toBeLessThanOrEqual(V2_LENGTH_TOLERANCE_MM)
      }
    })

    it('cuts at the beam are square; the far end keeps the contour miter', () => {
      const parts = purlinRows(result.pieces).filter((p) => /-[ab]$/.test(p.id))
      parts.forEach((p) => {
        const atBeam = p.id.endsWith('-a') ? p.cutMiterEndDeg : p.cutMiterStartDeg
        expect(atBeam).toBe(0)
      })
    })
  })
})

describe(`${SKEW_PENTAGON_850_V2_ID}: crossbeams do not depend on the plan orientation`, () => {
  it('mirrored and drawing frames give the same crossbeam lengths', () => {
    const round = (v: number) => Math.round(v * 1000) / 1000
    const lengths = (mirror: boolean) =>
      purlinRows(planFor(mirror).built.pieces).map((p) => [
        p.dividerId,
        round(p.lengthAxisMm),
        round(p.lengthLongMm),
        round(p.lengthShortMm),
      ])
    expect(lengths(true)).toEqual(lengths(false))
  })
})

// ---------------------------------------------------------------------------
// The extra 5030 shelf of the first PDF: an application rule, not a plan item.
// ---------------------------------------------------------------------------
describe(`${SKEW_PENTAGON_850_V2_ID}: auto wing shelf rule`, () => {
  const withRule = planFor(true, {
    ...pentagonV2PlanParams(DEFAULT_PLAN_CONSTRUCTION_PARAMS),
    purlinMaxSpanMm: 4000,
  })
  const shelves = withRule.built.pieces.filter((p) => p.dividerId === WING_SHELF_SPAN_DIVIDER_ID)

  it('with purlinMaxSpanMm = 4000 (new-plan default) a crossbeam longer than 4000 triggers two 3114.7 mm shelf pieces', () => {
    expect(Math.max(...purlinRows(withRule.built.pieces).map((p) => p.lengthAxisMm))).toBeGreaterThan(4000)
    expect(shelves.map((p) => [p.profileId, Math.round(p.lengthAxisMm * 10) / 10])).toEqual([
      ['purlin-plain-5030', 3114.7],
      ['purlin-plain-5030', 3114.7],
    ])
  })

  // The shape test of the rule is meant for G / L roofs with a notch. Here it picks the corner E
  // and puts the chord horizontally through E, which lies outside the pentagon. Plan data cannot
  // change that; this documents the misfire so the detector can be fixed.
  it.fails('the shelf lies inside the contour', () => {
    shelves.forEach((p) => {
      const { start, end } = pieceAxis(p)
      expect(pointInPolygon([(start[0] + end[0]) / 2, (start[1] + end[1]) / 2], withRule.contour)).toBe(true)
    })
  })

  it('the v2 plan leaves the rule off (purlinMaxSpanMm unset) and gets no shelf', () => {
    expect(planFor(true).built.pieces.some((p) => p.dividerId === WING_SHELF_SPAN_DIVIDER_ID)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Known deviations of the program (documented with it.fails; turn into `it` once fixed).
// ---------------------------------------------------------------------------
describe(`${SKEW_PENTAGON_850_V2_ID}: known deviations`, () => {
  // buildTopPlanDimensionModel replaces the measured clear chain with equal gaps whenever typed
  // outers exist, even when the plan stores manual crossbeam positions.
  it.fails('the sheet dimension chain shows the real gaps (6 x 1212, 2 x 1087), not 8 x 1181.1', () => {
    const { contour, params } = planFor(true)
    const model = buildPlanEditorOverlayModel({ contour, wallEdgeIndices: [], params, profiles })
    const gaps = model?.dimensionModel.purlinClearChain?.segmentsMm.map((v) => Math.round(v)) ?? []
    expect(gaps).toEqual([1212, 1212, 1212, 1212, 1212, 1212, 1087, 1087])
  })

  // Clockwise plan: typed outers land on the wrong sides (index shift in measuredOutersForCcwContour),
  // so the CD frame beam (2274 axis) is treated as an 8500 piece and spliced; 165 mm is the leftover.
  const cdPieces = (mirror: boolean) => {
    const { contour, built } = planFor(mirror)
    const a = contour[2]
    const b = contour[3]
    const onCd = (pt: Point2D) => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1])
      const dist = Math.abs((pt[0] - a[0]) * (b[1] - a[1]) - (pt[1] - a[1]) * (b[0] - a[0])) / len
      const along = ((pt[0] - a[0]) * (b[0] - a[0]) + (pt[1] - a[1]) * (b[1] - a[1])) / len
      return dist < 1 && along > -1 && along < len + 1
    }
    return built.pieces.filter((p) => {
      if (p.role !== 'beam') return false
      const axis = pieceAxis(p)
      return onCd(axis.start) && onCd(axis.end)
    })
  }

  it('drawing frame: the CD frame beam is one piece of 2274 axis / 2300 long', () => {
    const pieces = cdPieces(false)
    expect(pieces).toHaveLength(1)
    expect(Math.round(pieces[0].lengthAxisMm)).toBe(2274)
    expect(Math.round(pieces[0].lengthLongMm)).toBe(2300)
  })

  it.fails('mirrored plan: the CD frame beam is one piece of 2274 axis / 2300 long (today it is split 2134 + 165)', () => {
    const pieces = cdPieces(true)
    expect(pieces).toHaveLength(1)
    expect(Math.round(pieces[0].lengthLongMm)).toBe(2300)
  })
})

describe(`${SKEW_PENTAGON_850_V2_ID}: fixture sanity`, () => {
  it('typed outers, target outer polygon and centerline describe the same pentagon', () => {
    expect(V2_TYPED_OUTER_MM).toEqual(EXPECTED_SIDES_MM)
    const outer = outerFaceOf(V2_CENTERLINE_TARGET_MM.map(([x, y]): Point2D => [x, y]))
    const a = outer[0]
    outer.forEach((p, i) => {
      expect(Math.abs(p[0] - a[0] - V2_OUTER_TARGET_MM[i][0])).toBeLessThanOrEqual(V2_SIDE_TOLERANCE_MM)
      expect(Math.abs(p[1] - a[1] - V2_OUTER_TARGET_MM[i][1])).toBeLessThanOrEqual(V2_SIDE_TOLERANCE_MM)
    })
  })
})
