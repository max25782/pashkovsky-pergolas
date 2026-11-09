import { describe, expect, it } from 'vitest'
import { SLANTED_WING_CONTOUR_MM } from '../acceptance/slantedWingContour'
import {
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  PERGOLA_CONSTRUCTION_PROFILES,
  buildLamellaSections,
  buildPieces,
  specFromPlan,
  splitContourByLamellaZones,
  zoneFrameFromEdges,
} from '../index'
import { packProfile } from '../packProfile'
import { beamPlanWidthForDrawing } from '../beamPlanWidth'
import type { CutPiece, LamellaZone, Point2D } from '../types'

const PROFILES = PERGOLA_CONSTRUCTION_PROFILES
const KERF_MM = 3

/** Wing of the sketch: lamellas along the inner slant (edge 2), dividers along the short edge (edge 1). */
const WING_ZONE: LamellaZone = { id: 'wing', cutEdgeIndex: 2, lamellaEdgeIndex: 2, dividerEdgeIndex: 1 }

function planSpec(contour: Point2D[], lamellaZones?: LamellaZone[], dir = 90) {
  return specFromPlan({
    contour,
    wallEdgeIndices: [],
    params: {
      ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      lamellaDirectionDeg: dir,
      contourReference: 'outer-faces',
      ...(lamellaZones ? { lamellaZones } : {}),
    },
  })
}

function unitOf(a: Point2D, b: Point2D): Point2D {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  return [(b[0] - a[0]) / len, (b[1] - a[1]) / len]
}
const crossOf = (a: Point2D, b: Point2D) => a[0] * b[1] - a[1] * b[0]
/** Plan direction of a placed piece's length axis (rotation[1] is minus its azimuth). */
function pieceDir(piece: CutPiece): Point2D {
  return [Math.cos(-piece.rotation[1]), Math.sin(-piece.rotation[1])]
}
function polygonArea(pts: Point2D[]): number {
  let s = 0
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length]
    s += a[0] * b[1] - b[0] * a[1]
  })
  return Math.abs(s / 2)
}

const contour = SLANTED_WING_CONTOUR_MM
const edge = (i: number) => unitOf(contour[i], contour[(i + 1) % contour.length])
const wingBuilt = () => buildPieces(planSpec(contour, [WING_ZONE]), PROFILES)
const isWing = (piece: CutPiece) => piece.id.includes('-wing-')

describe('zone resolution from contour edges', () => {
  it('splits the contour into the wing parallelogram and the strip without losing area', () => {
    const split = splitContourByLamellaZones(contour, [WING_ZONE])
    expect(split.zones).toHaveLength(1)
    expect(split.remainder).not.toBeNull()
    const zoneArea = polygonArea(split.zones[0].polygon)
    const restArea = polygonArea((split.remainder ?? []).map((v) => v.p))
    expect(zoneArea + restArea).toBeCloseTo(polygonArea(contour), 3)
    // Wing = slanted parallelogram P0-Q-R-S: base |P0 S| = short edge (2700), height = x of Q.
    expect(zoneArea).toBeCloseTo(2700 * contour[1][0], 1)
  })

  it('takes the lamella direction from one edge and the divider direction from another', () => {
    const f = splitContourByLamellaZones(contour, [WING_ZONE]).zones[0].frame
    expect(Math.abs(crossOf(f.lamellaDir, edge(2)))).toBeLessThan(1e-9)
    expect(Math.abs(crossOf(f.dividerDir, edge(1)))).toBeLessThan(1e-9)
    expect(f.crossAngleDeg).toBeCloseTo(74.9, 2)
  })

  it('does not depend on where the plan sits: rotated and moved, the wing is the same', () => {
    const angle = (33 * Math.PI) / 180
    const moved = contour.map(([x, y]): Point2D => [
      x * Math.cos(angle) - y * Math.sin(angle) + 1234,
      x * Math.sin(angle) + y * Math.cos(angle) - 987,
    ])
    const a = buildPieces(planSpec(contour, [WING_ZONE]), PROFILES)
    const b = buildPieces(planSpec(moved, [WING_ZONE], 90 + 33), PROFILES)
    const lamellas = (built: typeof a) => built.pieces.filter((p) => isWing(p) && p.role === 'lamella')
    expect(lamellas(b)).toHaveLength(lamellas(a).length)
    expect(lamellas(b)[0].lengthAxisMm).toBeCloseTo(lamellas(a)[0].lengthAxisMm, 6)
    expect(lamellas(b)[0].cutMiterStartDeg).toBeCloseTo(lamellas(a)[0].cutMiterStartDeg, 6)
  })

  it('rejects directions that are parallel to each other and edge numbers that do not exist', () => {
    expect(() => zoneFrameFromEdges(contour, 2, 2)).toThrow(/parallel/)
    expect(() => splitContourByLamellaZones(contour, [{ ...WING_ZONE, cutEdgeIndex: 9 }])).toThrow(/not an edge/)
  })
})

describe('wing zone: lamellas along 8217, dividers along 2700', () => {
  const built = wingBuilt()
  const wingLamellas = built.pieces.filter((p) => isWing(p) && p.role === 'lamella')
  const wingDividers = built.pieces.filter((p) => isWing(p) && p.role === 'purlin')

  it('runs every wing lamella parallel to the slanted side and every wing divider parallel to the short side', () => {
    expect(wingLamellas.length).toBeGreaterThan(0)
    for (const lamella of wingLamellas) {
      expect(Math.abs(crossOf(pieceDir(lamella), edge(2)))).toBeLessThan(1e-9)
    }
    expect(wingDividers.length).toBeGreaterThan(0)
    for (const divider of wingDividers) {
      expect(Math.abs(crossOf(pieceDir(divider), edge(1)))).toBeLessThan(1e-9)
    }
  })

  it('leaves the strip on the plan-wide direction', () => {
    const strip = built.pieces.filter((p) => p.role === 'lamella' && !isWing(p))
    expect(strip.length).toBeGreaterThan(0)
    for (const lamella of strip) {
      expect(Math.abs(pieceDir(lamella)[0])).toBeLessThan(1e-9)
    }
  })

  it('cuts lamella and divider ends at the side angle (90 - 74.9 = 15.1 deg from square)', () => {
    for (const piece of [...wingLamellas, ...wingDividers]) {
      expect(piece.cutMiterStartDeg).toBeCloseTo(15.1, 1)
      expect(piece.cutMiterEndDeg).toBeCloseTo(15.1, 1)
      expect(piece.cutHandStart).not.toBe(piece.cutHandEnd)
      expect(piece.lengthLongMm).toBeGreaterThan(piece.lengthAxisMm)
      expect(piece.lengthShortMm).toBeLessThan(piece.lengthAxisMm)
    }
  })

  it('measures dividers from slanted face to slanted face, at the beam inner faces', () => {
    const beamW = beamPlanWidthForDrawing(PROFILES, 'f10040').planWidthMm
    const along = edge(2)
    for (const divider of wingDividers) {
      const start = divider.clipPlanStart as Point2D
      const end = divider.clipPlanEnd as Point2D
      // Outer slant edge 0 and inner slant edge 2 are the two faces the divider spans.
      expect(Math.abs(crossOf(along, [start[0] - contour[0][0], start[1] - contour[0][1]]))).toBeCloseTo(beamW, 3)
      expect(Math.abs(crossOf(along, [end[0] - contour[2][0], end[1] - contour[2][1]]))).toBeCloseTo(beamW, 3)
      expect(Math.hypot(end[0] - start[0], end[1] - start[1])).toBeCloseTo(divider.lengthAxisMm, 6)
    }
  })

  it('has parallelogram sections with positive sizes and a lamella count that matches the cut list', () => {
    const sections = buildLamellaSections(planSpec(contour, [WING_ZONE]), PROFILES).filter((s) => s.zoneId === 'wing')
    expect(sections.length).toBe(wingDividers.length + 1)
    for (const section of sections) {
      expect(section.widthMm).toBeGreaterThan(0)
      expect(section.heightMm).toBeGreaterThan(0)
      expect(section.lamellaCount).toBeGreaterThan(0)
      expect(section.oblique?.crossAngleDeg).toBeCloseTo(74.9, 2)
      expect(section.oblique?.cutMiterDeg).toBeCloseTo(15.1, 2)
    }
    expect(sections.reduce((n, s) => n + s.lamellaCount, 0)).toBe(wingLamellas.length)
    const sectionLengthSum = sections.reduce((sum, s) => sum + s.widthMm * s.lamellaCount, 0)
    expect(wingLamellas.reduce((sum, p) => sum + p.lengthAxisMm, 0)).toBeCloseTo(sectionLengthSum, 3)
  })

  it('puts the wing lamellas inside the 1400 mm span limit, so they raise no warning', () => {
    expect(built.warnings.filter((w) => w.pieceId?.includes('-wing-'))).toHaveLength(0)
    expect(Math.max(...wingLamellas.map((p) => p.lengthAxisMm))).toBeLessThanOrEqual(1400)
  })

  it('adds the beam line and post the cut needs, once', () => {
    expect(built.pieces.filter((p) => p.id.startsWith('beam-junction-'))).toHaveLength(1)
    expect(built.pieces.filter((p) => p.id.startsWith('post-junction-'))).toHaveLength(1)
  })

  it('packs every wing piece into the stock bars (profile summary and weight come from these)', () => {
    for (const [profileId, role] of [['f7020', 'lamella'], ['PA3022', 'purlin']] as const) {
      const pieces = built.pieces.filter((p) => p.profileId === profileId && p.role === role)
      const stock = Math.max(...(PROFILES.get(profileId)?.availableStockLengthsMm ?? [6000]))
      const plan = packProfile(pieces, stock, KERF_MM)
      const packed = plan.bars.flatMap((bar) => bar.pieces)
      expect(packed).toHaveLength(pieces.length)
      expect(packed.reduce((s, p) => s + p.lengthLongMm, 0)).toBeCloseTo(
        pieces.reduce((s, p) => s + p.lengthLongMm, 0),
        6,
      )
    }
  })
})

describe('a zone that narrows to a thin end', () => {
  // 6000 x 2000 at the left, 6000 x 100 at the right: the inner field is only 20 mm there.
  const tapered: Point2D[] = [[0, 0], [6000, 0], [6000, 100], [0, 2000]]
  const zone: LamellaZone = { id: 'taper', cutEdgeIndex: 0, lamellaEdgeIndex: 0, dividerEdgeIndex: 1 }

  it('never emits a section or lamella of zero or negative size', () => {
    const spec = planSpec(tapered, [zone], 0)
    const sections = buildLamellaSections(spec, PROFILES)
    expect(sections.length).toBeGreaterThan(0)
    for (const section of sections) {
      expect(section.widthMm).toBeGreaterThan(0)
      expect(section.heightMm).toBeGreaterThan(0)
      expect(section.lamellaCount).toBeGreaterThan(0)
    }
    const built = buildPieces(spec, PROFILES)
    for (const lamella of built.pieces.filter((p) => p.role === 'lamella')) {
      expect(lamella.lengthAxisMm).toBeGreaterThanOrEqual(1)
      expect(Number.isFinite(lamella.lengthLongMm)).toBe(true)
      expect(lamella.lengthShortMm).toBeGreaterThan(0)
    }
  })
})
