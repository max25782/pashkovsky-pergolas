import { describe, expect, it } from 'vitest'
import {
  beamPlanWidthForDrawing,
  buildOuterAxisClosureReport,
  buildPlanEditorOverlayModel,
  contourAxesMatchEnteredOuters,
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  outerVertexAtContourIndex,
  PERGOLA_CONSTRUCTION_PROFILES,
  polygonAreaM2,
  vertexAnglesForContour,
} from '@pashkovsky/pergola-core'
import type { Point2D } from '@pashkovsky/pergola-core'
import { createPlanEditorStore } from '../store'
import { toPolygon } from '../../geometry/chain'
import { closureGap } from '../../geometry/closure'
import type { FixedEdge } from '../../geometry/types'
import { commitOuterLengthMm } from '../../view-html/commitOuterLength'
import {
  SKEW_PENTAGON_850_ANGLES_DEG,
  SKEW_PENTAGON_850_BEAM_PLAN_WIDTH_MM,
  SKEW_PENTAGON_850_CENTERLINE_MM,
  SKEW_PENTAGON_850_ID,
  SKEW_PENTAGON_850_OUTER_AREA_M2,
  SKEW_PENTAGON_850_OUTER_CM,
  SKEW_PENTAGON_850_SIDES_CM,
  SKEW_PENTAGON_850_SIDE_TOLERANCE_CM,
  SKEW_PENTAGON_850_TYPED_OUTER_MM,
} from './fixtures/skew-pentagon-850-2026-11-01'

const TOLERANCE_MM = SKEW_PENTAGON_850_SIDE_TOLERANCE_CM * 10
const BEAM_W = beamPlanWidthForDrawing(
  PERGOLA_CONSTRUCTION_PROFILES,
  DEFAULT_PLAN_CONSTRUCTION_PARAMS.beamProfileId,
).planWidthMm

const toMm = (cm: number) => cm * 10
const asContour = (pts: ReadonlyArray<{ x: number; y: number }>): Point2D[] =>
  pts.map((p) => [p.x, p.y] as Point2D)
const sideLengths = (c: Point2D[]) =>
  c.map((p, i) => {
    const q = c[(i + 1) % c.length]
    return Math.hypot(q[0] - p[0], q[1] - p[1])
  })
/** Real outer face: every side moved outward by half the beam width, corners mitred. */
const outerFaceOf = (centerline: Point2D[]) =>
  centerline.map((_, i) => outerVertexAtContourIndex(centerline, i, BEAM_W / 2, BEAM_W / 2))
const asObjects = (c: Point2D[]) => c.map((p) => ({ x: p[0], y: p[1] }))

const EXPECTED_SIDES_MM = SKEW_PENTAGON_850_SIDES_CM.map(toMm)

describe(`${SKEW_PENTAGON_850_ID}: frozen centerline fixture`, () => {
  const centerline = asContour(SKEW_PENTAGON_850_CENTERLINE_MM)

  it('fixture was built for the beam the editor uses by default (f10040, 40 mm)', () => {
    expect(BEAM_W).toBe(SKEW_PENTAGON_850_BEAM_PLAN_WIDTH_MM)
  })

  it('editor accepts the pentagon: five vertices, closed, typed outers kept', () => {
    const store = createPlanEditorStore()
    store.getState().hydrateContour(
      [...SKEW_PENTAGON_850_CENTERLINE_MM],
      [],
      SKEW_PENTAGON_850_TYPED_OUTER_MM,
    )
    const s = store.getState()
    expect(s.isClosed).toBe(true)
    expect(s.fixedEdges).toHaveLength(5)
    expect(closureGap(s.fixedEdges).distMm).toBeLessThan(0.05)
    expect(s.fixedEdges.map((e) => e.measuredOuterLengthMm)).toEqual(SKEW_PENTAGON_850_TYPED_OUTER_MM)
    expect(toPolygon(s.fixedEdges)).toEqual(SKEW_PENTAGON_850_CENTERLINE_MM)
  })

  it('all five outer sides are within 0.05 cm of the drawing', () => {
    const lengths = sideLengths(outerFaceOf(centerline))
    lengths.forEach((len, i) => {
      expect(Math.abs(len - EXPECTED_SIDES_MM[i])).toBeLessThanOrEqual(TOLERANCE_MM)
    })
  })

  it('outer face is a closed simple pentagon (no gap between last and first vertex)', () => {
    const outer = outerFaceOf(centerline)
    expect(outer).toHaveLength(5)
    expect(sideLengths(outer).every((l) => l > 1)).toBe(true)
    // Closure of the sides as a vector sum is zero by construction of a vertex list;
    // the real check is that every side matches (test above) and the area matches.
    expect(Math.abs(polygonAreaM2(asObjects(outer)) - SKEW_PENTAGON_850_OUTER_AREA_M2)).toBeLessThanOrEqual(0.05)
  })

  it('interior angles match the drawing (A 90, B 126, C 153.9, D 86.1, E 84.0)', () => {
    const { angles, warning } = vertexAnglesForContour(centerline)
    expect(warning).toBeNull()
    angles.forEach((a, i) => {
      expect(Math.abs(a.interiorAngleDeg - SKEW_PENTAGON_850_ANGLES_DEG[i])).toBeLessThanOrEqual(0.1)
    })
  })

  it('stored (billable) area is the centerline area, smaller than the outer area', () => {
    const centerArea = polygonAreaM2(SKEW_PENTAGON_850_CENTERLINE_MM as { x: number; y: number }[])
    // Same rounding as roundBillableAreaSqm in apps/crm/lib/pergolas/pergola-area-sqm.ts.
    expect(Math.round(centerArea * 100) / 100).toBe(38.72)
    expect(SKEW_PENTAGON_850_OUTER_AREA_M2 - centerArea).toBeGreaterThan(0.5)
  })
})

// ---------------------------------------------------------------------------
// What the editor does today when the five outer sizes are typed.
// Headings come from the drawing (exact), outer sizes are typed one side at a time
// through the same commit function the side panel uses.
// `it.fails` documents a known deviation: the test turns red when it is fixed,
// at which point it must become a plain `it`.
// ---------------------------------------------------------------------------

function overlayFor(edges: FixedEdge[]) {
  const contour = toPolygon(edges).map((p) => [p.x, p.y] as Point2D)
  const measured = new Map<string, number>()
  for (const e of edges) if (e.measuredOuterLengthMm != null) measured.set(e.id, e.measuredOuterLengthMm)
  return buildPlanEditorOverlayModel({
    contour,
    wallEdgeIndices: [],
    params: { ...DEFAULT_PLAN_CONSTRUCTION_PARAMS },
    profiles: PERGOLA_CONSTRUCTION_PROFILES,
    edgeIds: edges.map((e) => e.id),
    contourClosureGapMm: closureGap(edges).distMm,
    measuredOuterLengthMmByEdgeId: measured,
  })
}

function typeOutersInEditor() {
  const store = createPlanEditorStore()
  store.getState().hydrateContour(
    SKEW_PENTAGON_850_OUTER_CM.map(([x, y]) => ({ x: toMm(x), y: toMm(y) })),
    [],
  )
  SKEW_PENTAGON_850_TYPED_OUTER_MM.forEach((outerMm, i) => {
    commitOuterLengthMm(outerMm, store.getState().fixedEdges[i].id, {
      overlayForFixedEdges: overlayFor,
      getFixedEdges: () => store.getState().fixedEdges,
      applyOuterLengths: (outers, idx) => store.getState().applyOuterLengths(outers, idx, BEAM_W),
    })
  })
  return store
}

describe(`${SKEW_PENTAGON_850_ID}: typing the five outer sizes in the editor (current behaviour)`, () => {
  it('typed outers are stored as typed and the outer sizes close with the drawing headings', () => {
    const store = typeOutersInEditor()
    const edges = store.getState().fixedEdges
    expect(edges.map((e) => e.measuredOuterLengthMm)).toEqual(SKEW_PENTAGON_850_TYPED_OUTER_MM)
    const report = buildOuterAxisClosureReport({
      outerLengthsMm: SKEW_PENTAGON_850_TYPED_OUTER_MM,
      angleDeg: edges.map((e) => e.angleDeg),
      defaultBeamPlanWidthMm: BEAM_W,
    })
    expect(report.kinematicOuterGapMm).toBeLessThanOrEqual(TOLERANCE_MM)
  })

  // Deviation 1: axis = outer - 40 mm on every side, correct only at 90 degree corners.
  it.fails('centerline closes after typing (axis gap <= 0.5 mm)', () => {
    const edges = typeOutersInEditor().getState().fixedEdges
    expect(closureGap(edges).distMm).toBeLessThanOrEqual(TOLERANCE_MM)
  })

  // Deviation 2: the real beam outer face is shorter than the typed size on every side.
  it.fails('real outer sides equal the typed sizes within 0.05 cm', () => {
    const edges = typeOutersInEditor().getState().fixedEdges
    const lengths = sideLengths(outerFaceOf(toPolygon(edges).map((p) => [p.x, p.y] as Point2D)))
    lengths.forEach((len, i) => {
      expect(Math.abs(len - EXPECTED_SIDES_MM[i])).toBeLessThanOrEqual(TOLERANCE_MM)
    })
  })

  // Deviation 3: the program's own width check rejects the exact centerline.
  it.fails('the exact centerline is accepted by contourAxesMatchEnteredOuters', () => {
    expect(
      contourAxesMatchEnteredOuters({
        contour: asContour(SKEW_PENTAGON_850_CENTERLINE_MM),
        measuredOuterLengthMmByEdgeIndex: SKEW_PENTAGON_850_TYPED_OUTER_MM,
        defaultBeamPlanWidthMm: BEAM_W,
      }),
    ).toBe('match')
  })
})
