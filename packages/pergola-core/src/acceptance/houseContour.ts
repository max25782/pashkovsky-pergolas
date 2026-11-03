import type { Point2D } from '../types'
import { DEFAULT_PLAN_CONSTRUCTION_PARAMS, type PlanConstructionParams } from '../planDefaults'
import { specFromPlan, type SpecFromPlanInput } from '../buildPieces'

/** Closing / ring-gap warning threshold — 1 cm. */
export const CLOSURE_GAP_TOLERANCE_MM = 10

export const HOUSE_VERTEX_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const

/** Tape measure in cm, as given. Converted to mm for the core. */
export const HOUSE_VERTICES_CM: ReadonlyArray<{ letter: string; x: number; y: number }> = [
  { letter: 'A', x: 0, y: 0 },
  { letter: 'B', x: 949.5, y: 0 },
  { letter: 'C', x: 949.5, y: 748 },
  { letter: 'D', x: 674.5, y: 748 },
  { letter: 'E', x: 674.5, y: 461.5 },
  { letter: 'F', x: 328, y: 460.9 },
  { letter: 'G', x: 328, y: 748 },
  { letter: 'H', x: 0, y: 748 },
]

export const HOUSE_CONTOUR_MM: Point2D[] = HOUSE_VERTICES_CM.map((v) => [v.x * 10, v.y * 10])

/** C-D, D-E, E-F, F-G — house attachment. */
export const HOUSE_WALL_EDGE_INDICES = [2, 3, 4, 5]

/** A-B, B-C, G-H, H-A */
export const HOUSE_FREE_EDGE_INDICES = [0, 1, 6, 7]

export const HOUSE_EDGE_LABELS = ['A-B', 'B-C', 'C-D', 'D-E', 'E-F', 'F-G', 'G-H', 'H-A'] as const

export const HOUSE_GH_EDGE_INDEX = 6

export const HOUSE_RAL_1013_HEX = '#E3D9C6'

export const HOUSE_REFERENCE_PRICE_ILS = 48000
export const HOUSE_REFERENCE_AREA_M2 = 60

/** Tape edge lengths — contour vertices are outer faces, so L_outer ≈ axis. */
export function houseMeasuredOuterLengthMm(contour: Point2D[] = HOUSE_CONTOUR_MM): number[] {
  const n = contour.length
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const a = contour[i]
    const b = contour[(i + 1) % n]
    out.push(Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])))
  }
  return out
}

export function houseConstructionParams(
  overrides: Partial<PlanConstructionParams> = {},
): PlanConstructionParams {
  return {
    ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
    colorHex: HOUSE_RAL_1013_HEX,
    supportType: 'wall-mounted',
    measuredOuterLengthMmByEdgeIndex: houseMeasuredOuterLengthMm(),
    // Outer tape vertices — width changes must not rebuild to centerline.
    contourReference: 'outer-faces',
    ...overrides,
  }
}

export function houseSpecInput(
  contour: Point2D[] = HOUSE_CONTOUR_MM,
  overrides: Partial<PlanConstructionParams> = {},
): SpecFromPlanInput {
  const measured =
    overrides.measuredOuterLengthMmByEdgeIndex ?? houseMeasuredOuterLengthMm(contour)
  return {
    contour,
    wallEdgeIndices: HOUSE_WALL_EDGE_INDICES,
    params: houseConstructionParams({
      ...overrides,
      measuredOuterLengthMmByEdgeIndex: measured,
    }),
  }
}

export function houseSpec(contour: Point2D[] = HOUSE_CONTOUR_MM) {
  return specFromPlan(houseSpecInput(contour))
}

/**
 * Ring closure: last→first of a vertex list that already includes every
 * corner (A is not duplicated). A closed ring has gap 0. If the host
 * duplicated the start point, the leftover last→first distance is the gap.
 */
export function contourClosureGapMm(contour: Point2D[]): number {
  if (contour.length < 2) return Infinity
  const first = contour[0]
  const last = contour[contour.length - 1]
  const dup = Math.hypot(last[0] - first[0], last[1] - first[1])
  if (dup <= CLOSURE_GAP_TOLERANCE_MM) return dup
  return 0
}

/**
 * G-H is 328 cm (G.x=328, H.x=0). Stretch to `ghCm` by sliding H and A
 * together so H-A stays vertical and the ring stays closed. House walls
 * C–G are unchanged.
 */
export function houseContourWithGhCm(ghCm: number): Point2D[] {
  const pts: Point2D[] = HOUSE_CONTOUR_MM.map((p) => [p[0], p[1]])
  const g = pts[6]
  const hX = g[0] - ghCm * 10
  pts[7] = [hX, g[1]]
  pts[0] = [hX, pts[0][1]]
  return pts
}
