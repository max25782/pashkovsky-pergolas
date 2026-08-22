import type { Point2D } from './types'
import { isCCW } from './miter'

/** Tolerance for "are these two grid coordinates the same wall line", mm — used only
 * for de-duplicating coordinates AFTER `regularizeNearOrthogonalContour` has already
 * unified each near-axis edge's own two endpoints (see below), so this only needs to
 * absorb float noise, not real-world drafting drift. */
const ORTHOGONAL_EPS_MM = 0.5

/**
 * Max deviation from a cardinal direction (0/90/180/270°) tolerated when deciding
 * whether a contour edge counts as "axis-aligned" — see prompt "разложение формы на
 * прямоугольники", tested against a REAL hand-drawn plan (see chat: L-shape closing
 * edge measured 100.11mm off-vertical over a 5593.84mm run, i.e. ~1.02°). A hand-drawn
 * or tape-measured pergola contour essentially never closes at an EXACT 90°/0.5mm —
 * gating on raw mm difference (the old approach) rejected that whole contour as
 * "non-orthogonal" and silently fell back to the old per-node greedy segmentation for
 * ALL of its beams, reintroducing exactly the sliver bug this module exists to fix.
 * 3° comfortably covers realistic measurement/drawing slop while still rejecting a
 * genuinely diagonal corner (the trapezoid regression test's corner is ~33.7° off —
 * nowhere near this threshold).
 */
const ORTHOGONAL_ANGLE_TOLERANCE_DEG = 3

/** `sin` of the tolerance angle — comparing `min(|dx|,|dy|) / length` against this is
 * equivalent to comparing the edge's angle from the nearest cardinal direction against
 * `ORTHOGONAL_ANGLE_TOLERANCE_DEG`, without a per-edge `Math.atan2` call. */
const ORTHOGONAL_SIN_TOLERANCE = Math.sin((ORTHOGONAL_ANGLE_TOLERANCE_DEG * Math.PI) / 180)

export interface Rectangle {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/**
 * Angle tolerance (degrees) for the STRICT orthogonality flag exposed to
 * the user (see `isOrthogonalContour`) — deliberately its OWN constant,
 * NOT `ORTHOGONAL_ANGLE_TOLERANCE_DEG` above (still smaller/stricter than
 * that 3° — see this constant's own tradeoff note below), and deliberately
 * an ANGLE, not a fixed mm epsilon like the previous `STRICT_ORTHOGONAL_EPS_MM`
 * this replaces.
 *
 * See prompt "плашка неортогональности ложно срабатывает": a fixed mm
 * epsilon independent of edge length means a LONGER edge fails the check
 * for the exact same real-world angular deviation a SHORTER edge would
 * pass — e.g. a hand-drawn/mouse-drawn 8500mm edge that's off-vertical by
 * only ~0.7° already drifts ~100mm in X, comfortably past any mm epsilon
 * small enough to still reject a genuinely diagonal wall, so every
 * realistically-sized rectangular contour a user actually draws would get
 * flagged "approximate" even though it is, for every practical purpose,
 * square. An angle tolerance judges the SAME real-world drafting slop the
 * same way regardless of how long the edge happens to be.
 *
 * `isOrthogonalContour` still answers a DIFFERENT question than
 * `decomposeIntoRectangles`'s own 3° tolerance above — "is this shape
 * honestly, visibly non-orthogonal, such that the user should be told the
 * post layout is only approximate" (see prompt "честная плашка для
 * неортогональных форм") vs. "can we still compute this exactly despite
 * some slop" — so this stays its own, stricter constant, not reused from
 * `ORTHOGONAL_ANGLE_TOLERANCE_DEG`. 1° comfortably passes the prompt's own
 * "89.9° — в допуске" boundary case and rejects its "88° — вне допуска,
 * заметно косая" case, while still catching a genuinely diagonal wall (a
 * 60° corner, or the trapezoid regression's ~33.7° corner) by a wide margin.
 */
const STRICT_ORTHOGONAL_ANGLE_TOLERANCE_DEG = 1

/** `sin` of `STRICT_ORTHOGONAL_ANGLE_TOLERANCE_DEG` — see `classifyEdgeAxis`'s
 * own `ORTHOGONAL_SIN_TOLERANCE` for why comparing `min(|dx|,|dy|) / length`
 * against this is equivalent to an angle-from-cardinal-direction check
 * without a per-edge `Math.atan2` call. */
const STRICT_ORTHOGONAL_SIN_TOLERANCE = Math.sin((STRICT_ORTHOGONAL_ANGLE_TOLERANCE_DEG * Math.PI) / 180)

/**
 * Honest, user-facing orthogonality check — see prompt "честная плашка для
 * неортогональных форм": every edge must lie within
 * `STRICT_ORTHOGONAL_ANGLE_TOLERANCE_DEG` of a cardinal direction (0/90/180/270°),
 * evaluated as an ANGLE (length-independent — see that constant's own
 * docstring for why this replaced a fixed mm epsilon), not as a fixed mm
 * deviation the way this function used to. A degenerate (near-zero-length)
 * edge is skipped — it contributes no direction information and must not,
 * by itself, make an otherwise-square contour report as non-orthogonal.
 * This is the single source of truth for `FrameResult.isOrthogonal` (see
 * `computeFrame`) and therefore for whether the "приблизительно" warning
 * banner appears on the drawing sheets — deliberately NOT derived from
 * `decomposeIntoRectangles`'s own null/non-null result.
 */
export function isOrthogonalContour(contour: Point2D[]): boolean {
  const n = contour.length
  if (n < 3) return false
  for (let i = 0; i < n; i++) {
    const a = contour[i]
    const b = contour[(i + 1) % n]
    const dx = Math.abs(b[0] - a[0])
    const dy = Math.abs(b[1] - a[1])
    const length = Math.hypot(dx, dy)
    if (length <= 1e-6) continue
    const offAxisComponent = Math.min(dx, dy)
    if (offAxisComponent > length * STRICT_ORTHOGONAL_SIN_TOLERANCE) return false
  }
  return true
}

/**
 * Classifies one contour edge as effectively vertical (constant X) or horizontal
 * (constant Y) within `ORTHOGONAL_ANGLE_TOLERANCE_DEG`. Returns `null` for a
 * degenerate (near-zero-length) edge or a genuinely diagonal one — either bails the
 * whole decomposition (see `regularizeNearOrthogonalContour`).
 */
function classifyEdgeAxis(a: Point2D, b: Point2D): 'x' | 'y' | null {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const length = Math.hypot(dx, dy)
  if (length <= 1e-6) return null
  const isVertical = Math.abs(dx) <= length * ORTHOGONAL_SIN_TOLERANCE
  const isHorizontal = Math.abs(dy) <= length * ORTHOGONAL_SIN_TOLERANCE
  if (isVertical && !isHorizontal) return 'x'
  if (isHorizontal && !isVertical) return 'y'
  return null
}

/**
 * Snaps a contour whose edges are each individually within
 * `ORTHOGONAL_ANGLE_TOLERANCE_DEG` of a cardinal direction into an EXACTLY rectilinear
 * one, by unifying each such edge's two endpoint coordinates along its own axis (the
 * two X's of a near-vertical edge become their average; same for Y on a near-horizontal
 * edge) — see prompt "продолжения внутренних стен" grid logic below, which assumes
 * perfectly-equal coordinates along a wall, not merely "close".
 *
 * Returns `null` (→ caller falls back to node-based segmentation) when any edge is
 * genuinely diagonal, i.e. neither classification wins outright (a real ~45° corner
 * like the trapezoid regression case, not measurement noise on a corner meant to be
 * square).
 */
function regularizeNearOrthogonalContour(contour: Point2D[]): Point2D[] | null {
  const n = contour.length
  const axis: Array<'x' | 'y'> = []
  for (let i = 0; i < n; i++) {
    const a = classifyEdgeAxis(contour[i], contour[(i + 1) % n])
    if (a == null) return null
    axis.push(a)
  }

  const snapped: Point2D[] = contour.map((p) => [p[0], p[1]] as Point2D)
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    if (axis[i] === 'x') {
      const avgX = (contour[i][0] + contour[j][0]) / 2
      snapped[i][0] = avgX
      snapped[j][0] = avgX
    } else {
      const avgY = (contour[i][1] + contour[j][1]) / 2
      snapped[i][1] = avgY
      snapped[j][1] = avgY
    }
  }
  return snapped
}

/** Sorted, de-duplicated (within ORTHOGONAL_EPS_MM) list of distinct coordinate values. */
function dedupSortedCoords(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b)
  const out: number[] = []
  for (const v of sorted) {
    if (out.length === 0 || v - out[out.length - 1] > ORTHOGONAL_EPS_MM) out.push(v)
  }
  return out
}

/**
 * Tolerance for "is this point on the segment's line" / "is this reach-depth
 * effectively the same", mm — same role and value as beamSegmentation.ts's
 * own `EPS_MM`, kept as a separate local constant (not shared) so this
 * module never has to import from `beamSegmentation.ts` — see
 * `findWingBoundariesAlongSegment`'s own docstring for why that direction
 * of dependency must not exist.
 */
const WING_EPS_MM = 1

/** Standard even-odd ray-casting point-in-polygon test. */
function pointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  let inside = false
  const n = polygon.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    const crosses =
      yi !== yj &&
      ((point[1] >= yi && point[1] < yj) || (point[1] >= yj && point[1] < yi)) &&
      point[0] < xi + ((point[1] - yi) / (yj - yi)) * (xj - xi)
    if (crosses) inside = !inside
  }
  return inside
}

/**
 * Decompose an orthogonal (axis-aligned) simple polygon into a set of
 * non-overlapping rectangles that exactly cover its area — see prompt
 * "разложение формы на прямоугольники ПЕРЕД сегментацией балок".
 *
 * Method: every distinct vertex X coordinate and every distinct vertex Y
 * coordinate is a grid line (this is exactly "continue every edge meeting
 * at a reflex vertex to the opposite contour side" — a reflex vertex's own
 * two edges already contribute its X and Y to the grid; convex vertices
 * contribute grid lines too, but produce no extra rectangles since the
 * cell on the outside of the polygon at that line is empty by construction).
 * Every grid cell whose center lies inside the polygon becomes one output
 * rectangle. This is a standard, non-minimal but always-correct rectilinear
 * decomposition (no attempt to merge cells into the fewest possible
 * rectangles — see prompt "не изобретать сложный оптимальный минимум").
 *
 * A single-notch L (one reflex vertex) yields exactly 3 rectangles: the
 * corner block common to both wings, plus one rectangle per wing — see
 * prompt "L-форма = ТРИ прямоугольника". A two-notch U yields exactly 5.
 * A plain rectangle (no reflex vertices) yields exactly 1 — itself.
 *
 * Returns null when any contour edge is not axis-aligned even after tolerating
 * realistic measurement drift (e.g. a trapezoid corner) — callers MUST fall back to
 * the previous node-based segmentation logic for such shapes; a wrong rectangle grid
 * is worse than an honest "not applicable" (see prompt "Оговорка про неортогональные
 * формы").
 */
export function decomposeIntoRectangles(contourInput: Point2D[]): Rectangle[] | null {
  if (contourInput.length < 4) return null

  const oriented = isCCW(contourInput) ? contourInput : [...contourInput].reverse()
  const contour = regularizeNearOrthogonalContour(oriented)
  if (contour == null) return null

  const xs = dedupSortedCoords(contour.map((p) => p[0]))
  const ys = dedupSortedCoords(contour.map((p) => p[1]))

  const rectangles: Rectangle[] = []
  for (let xi = 0; xi + 1 < xs.length; xi++) {
    const minX = xs[xi]
    const maxX = xs[xi + 1]
    for (let yi = 0; yi + 1 < ys.length; yi++) {
      const minY = ys[yi]
      const maxY = ys[yi + 1]
      const center: Point2D = [(minX + maxX) / 2, (minY + maxY) / 2]
      if (pointInPolygon(center, contour)) {
        rectangles.push({ minX, maxX, minY, maxY })
      }
    }
  }

  return rectangles
}

/**
 * Project `point` onto the infinite line through (segStart, segDir).
 * Returns the signed distance along `segDir` from segStart iff `point` lies
 * within WING_EPS_MM of that line (perpendicular distance), else `null` — a
 * point that merely happens to be nearby but off-axis is not a valid split
 * candidate. Deliberately duplicated (not imported) from
 * beamSegmentation.ts's own `projectOntoAxis`: that module already depends
 * on this one (`decomposeIntoRectangles`), so importing back from it would
 * create a real (value-level, not just type-level) circular dependency —
 * see prompt "циклической зависимости нет — путь (а) реалистичен". Ten
 * lines of pure arithmetic duplicated once is far cheaper than that.
 */
function projectOntoSegmentAxis(segStart: Point2D, segDir: Point2D, point: Point2D): number | null {
  const rel: Point2D = [point[0] - segStart[0], point[1] - segStart[1]]
  const along = rel[0] * segDir[0] + rel[1] * segDir[1]
  const perp = -rel[0] * segDir[1] + rel[1] * segDir[0]
  if (Math.abs(perp) > WING_EPS_MM) return null
  return along
}

/**
 * One rectangle reprojected onto a segment's own "main" axis (along the
 * segment) / "depth" axis (perpendicular, into the polygon interior) — see
 * beamSegmentation.ts's original `AxisRect`, moved here alongside the
 * reach-depth walk it exists for (see `findWingBoundariesAlongSegment`).
 */
interface AxisRect {
  mainMin: number
  mainMax: number
  depthMin: number
  depthMax: number
}

/**
 * Total contiguous interior depth starting at `depthStart` (the segment's
 * own line) and walking in direction `sign` through consecutive rectangles
 * that all cover the same `mainCoord` column, stopping the instant no
 * rectangle continues the chain (a real exterior gap) — see prompt
 * "продолжением внутренней стены": this IS that continuation, expressed as
 * "how far does solid material reach away from the segment before hitting
 * true exterior", rather than "does some rectangle boundary happen to cross
 * this column".
 */
function reachDepthAt(rects: AxisRect[], mainCoord: number, depthStart: number, sign: 1 | -1): number {
  let depth = 0
  let cursor = depthStart
  for (;;) {
    const cell = rects.find(
      (r) =>
        r.mainMin <= mainCoord + WING_EPS_MM &&
        r.mainMax >= mainCoord - WING_EPS_MM &&
        (sign === 1 ? Math.abs(r.depthMin - cursor) <= WING_EPS_MM : Math.abs(r.depthMax - cursor) <= WING_EPS_MM),
    )
    if (!cell) return depth
    depth += cell.depthMax - cell.depthMin
    cursor = sign === 1 ? cell.depthMax : cell.depthMin
  }
}

/**
 * Main-axis coordinates, strictly between `mainMin` and `mainMax`, where the
 * reach-depth (see `reachDepthAt`) actually CHANGES from one column to the
 * next — the mandatory wing-split points for one segment lying along
 * `depthBeam`. See `findWingBoundariesAlongSegment`'s own docstring for the
 * full rationale (moved here unchanged from beamSegmentation.ts's original
 * `findReachDiscontinuities`).
 */
function findReachDiscontinuities(
  rects: AxisRect[],
  mainMin: number,
  mainMax: number,
  depthBeam: number,
): number[] {
  const bordersFromBelow = rects.some(
    (r) =>
      Math.abs(r.depthMin - depthBeam) <= WING_EPS_MM &&
      r.mainMax > mainMin + WING_EPS_MM &&
      r.mainMin < mainMax - WING_EPS_MM,
  )
  const bordersFromAbove = rects.some(
    (r) =>
      Math.abs(r.depthMax - depthBeam) <= WING_EPS_MM &&
      r.mainMax > mainMin + WING_EPS_MM &&
      r.mainMin < mainMax - WING_EPS_MM,
  )
  const sign: 1 | -1 | 0 = bordersFromBelow ? 1 : bordersFromAbove ? -1 : 0
  if (sign === 0) return []

  const mainCoordsSet = new Set<number>()
  for (const r of rects) {
    if (r.mainMin >= mainMin - WING_EPS_MM && r.mainMin <= mainMax + WING_EPS_MM) mainCoordsSet.add(r.mainMin)
    if (r.mainMax >= mainMin - WING_EPS_MM && r.mainMax <= mainMax + WING_EPS_MM) mainCoordsSet.add(r.mainMax)
  }
  const mainCoords = [...mainCoordsSet].sort((a, b) => a - b)

  const reaches: number[] = []
  for (let i = 0; i + 1 < mainCoords.length; i++) {
    const mid = (mainCoords[i] + mainCoords[i + 1]) / 2
    reaches.push(reachDepthAt(rects, mid, depthBeam, sign))
  }

  const boundaries: number[] = []
  for (let i = 0; i + 1 < reaches.length; i++) {
    if (Math.abs(reaches[i] - reaches[i + 1]) > WING_EPS_MM) boundaries.push(mainCoords[i + 1])
  }
  return boundaries
}

/**
 * Structural wing-boundary distances (mm, measured from `segStart` along
 * `segStart → segEnd`) imposed by the contour's shape, for ONE straight
 * segment lying on that line — see prompt "разложение формы на
 * прямоугольники ПЕРЕД сегментацией балок". This is the single, shared
 * primitive both `beamSegmentation.ts`'s `findRectangleWingBoundaries` (per
 * already-built beam `CutPiece`) AND `frame.ts`'s own edge-segmentation
 * (per RAW contour edge, before any beam/post exists yet — see prompt
 * "maxSpanMm-стойки ставятся ПОСЛЕ деления на прямоугольники, не до")
 * delegate to, so the two can never derive a different answer for the same
 * physical wall.
 *
 * Lives here (not in beamSegmentation.ts) specifically so `frame.ts` can
 * call it too WITHOUT depending on `beamSegmentation.ts` — `frame.ts` is
 * the more upstream/foundational module (its own `FrameResult` is
 * `beamSegmentation.ts`'s input), so the dependency must point this
 * direction, not the other way.
 *
 * `rectangles` is `null` for a non-orthogonal contour (`decomposeIntoRectangles`
 * itself returns null there): this function then returns `[]`, so the
 * caller falls back entirely to its own existing joint/post (stock) logic —
 * see prompt "Оговорка про неортогональные формы".
 *
 * Only a segment parallel to the X or Z axis is handled (every perimeter
 * beam/edge on an orthogonal contour is, by construction).
 *
 * These points are mandatory construction joints even when the resulting
 * wings are shorter than stock/maxSpanMm.
 */
export function findWingBoundariesAlongSegment(
  segStart: Point2D,
  segEnd: Point2D,
  rectangles: Rectangle[] | null,
): number[] {
  if (!rectangles || rectangles.length === 0) return []

  const totalLenMm = Math.hypot(segEnd[0] - segStart[0], segEnd[1] - segStart[1])
  if (totalLenMm <= WING_EPS_MM) return []
  const dir: Point2D = [(segEnd[0] - segStart[0]) / totalLenMm, (segEnd[1] - segStart[1]) / totalLenMm]

  const isHorizontal = Math.abs(dir[1]) <= 1e-6
  const isVertical = Math.abs(dir[0]) <= 1e-6
  if (!isHorizontal && !isVertical) return []

  const mainMin = isHorizontal ? Math.min(segStart[0], segEnd[0]) : Math.min(segStart[1], segEnd[1])
  const mainMax = isHorizontal ? Math.max(segStart[0], segEnd[0]) : Math.max(segStart[1], segEnd[1])
  const depthBeam = isHorizontal ? segStart[1] : segStart[0]

  const axisRects: AxisRect[] = rectangles.map((r) =>
    isHorizontal
      ? { mainMin: r.minX, mainMax: r.maxX, depthMin: r.minY, depthMax: r.maxY }
      : { mainMin: r.minY, mainMax: r.maxY, depthMin: r.minX, depthMax: r.maxX },
  )

  const mainBoundaries = findReachDiscontinuities(axisRects, mainMin, mainMax, depthBeam)

  const boundaries: number[] = []
  for (const coord of mainBoundaries) {
    const point: Point2D = isHorizontal ? [coord, depthBeam] : [depthBeam, coord]
    const distMm = projectOntoSegmentAxis(segStart, dir, point)
    if (distMm != null && distMm > WING_EPS_MM && distMm < totalLenMm - WING_EPS_MM) boundaries.push(distMm)
  }

  return boundaries.sort((a, b) => a - b)
}

// ── Shape-wide grid (single source for maxSpanMm posts, see prompt "единая
// сетка стоек через всю форму") ─────────────────────────────────────────────

/**
 * One axis's shape-wide grid: the mandatory wall coordinates (real,
 * reach-verified walls — see `findWingBoundariesAlongSegment` — union of
 * EVERY edge on this axis, plus the contour's own outer bounding extent)
 * and the maxSpanMm coordinates filling each gap between adjacent walls
 * wider than maxSpanMm. See prompt "intermediatesMm считается от
 * ОБЪЕДИНЁННОГО списка стен, а не от длины каждого ребра" — this is exactly
 * that union, computed once for the whole contour.
 */
export interface AxisGrid {
  /** Sorted, deduplicated (ORTHOGONAL_EPS_MM) absolute coordinates. */
  wallsMm: number[]
  /** Sorted absolute coordinates, disjoint from `wallsMm` (see
   * `minPostSpacingMm` — anything that landed within that distance of a
   * wall was DROPPED, never shifted onto it — see prompt "выброс, а не
   * сдвиг"). */
  intermediatesMm: number[]
}

export interface ShapeGrid {
  /** Vertical lines (constant X) — consumed by HORIZONTAL edges. */
  xGrid: AxisGrid
  /** Horizontal lines (constant Y) — consumed by VERTICAL edges. */
  yGrid: AxisGrid
}

/**
 * Minimum spacing (mm) a maxSpanMm-filled intermediate line must keep from
 * every wall line, expressed as a FRACTION of maxSpanMm rather than a fixed
 * mm constant — see prompt "MIN_POST_SPACING_MM зависит от maxSpanMm, а его
 * нет": a profile with maxSpanMm≈1500 (where this whole defect surfaced,
 * worst case ≈750mm from a wall) and one with maxSpanMm=5000 need different
 * absolute floors, so this scales with the profile actually in use.
 * `DEFAULT_MIN_POST_SPACING_MM` is only the fallback when maxSpanMm itself
 * is unknown (undefined/≤0) — not a general floor.
 */
export const MIN_POST_SPACING_RATIO = 0.25
export const DEFAULT_MIN_POST_SPACING_MM = 700

export function minPostSpacingMm(maxSpanMm: number | undefined): number {
  if (maxSpanMm == null || maxSpanMm <= 0) return DEFAULT_MIN_POST_SPACING_MM
  return maxSpanMm * MIN_POST_SPACING_RATIO
}

/**
 * Drops (never shifts — see prompt "убедись, что merge именно выбрасывает,
 * а не двигает координату") any candidate that falls within `minSpacingMm`
 * of a wall, or of an already-kept candidate. A wall always wins: it is
 * never itself removed or moved by this pass, so two edges that both read
 * the same shared `wallsMm` stay in lock-step (fixes symptom 1) even after
 * this safety net runs (fixes symptom 2) — the two cannot fight each other
 * because only DROPPING happens here, never repositioning.
 */
export function dropTooCloseToWalls(candidatesMm: number[], wallsMm: number[], minSpacingMm: number): number[] {
  const sorted = [...candidatesMm].sort((a, b) => a - b)
  const kept: number[] = []
  for (const c of sorted) {
    if (wallsMm.some((w) => Math.abs(w - c) < minSpacingMm)) continue
    if (kept.some((k) => Math.abs(k - c) < minSpacingMm)) continue
    kept.push(c)
  }
  return kept
}

function buildAxisGrid(wallsAbsRaw: number[], maxSpanMm: number | undefined, minSpacingMm: number): AxisGrid {
  const wallsMm = dedupSortedCoords(wallsAbsRaw)
  const intermediatesRaw: number[] = []
  if (maxSpanMm != null && maxSpanMm > 0) {
    for (let i = 0; i + 1 < wallsMm.length; i++) {
      const gapStartMm = wallsMm[i]
      const gapEndMm = wallsMm[i + 1]
      const gapLenMm = gapEndMm - gapStartMm
      const nInter = Math.ceil(gapLenMm / maxSpanMm) - 1
      for (let k = 1; k <= nInter; k++) {
        intermediatesRaw.push(gapStartMm + (k / (nInter + 1)) * gapLenMm)
      }
    }
  }
  const intermediatesMm = dropTooCloseToWalls(intermediatesRaw, wallsMm, minSpacingMm)
  return { wallsMm, intermediatesMm }
}

/**
 * Build the whole contour's shape-wide post grid — see prompt "единая сетка
 * стоек через всю форму": ONE `wallsMm` list per axis, shared by EVERY edge
 * running along that axis (not recomputed per-edge from that edge's own
 * length), so two parallel edges (a shape's "top" and "bottom") that both
 * see the same real wall land their maxSpanMm-filled points on the exact
 * same coordinates — by construction, not by coincidence (see prompt
 * "координаты X совпадают по построению, а не случайно").
 *
 * `wallsMm` per axis = union, across EVERY edge on that axis, of
 * `findWingBoundariesAlongSegment`'s reach-verified boundaries (converted
 * to absolute coordinates) + the contour's own outer bounding box on that
 * axis (the "внешние стороны контура"). `findWingBoundariesAlongSegment`
 * itself is untouched — this only collects its per-edge answers into one
 * shared list instead of consuming each in isolation.
 *
 * Returns `null` for a non-orthogonal contour (`rectangles === null`) —
 * callers must fall back entirely to the old per-edge computation, exactly
 * as before this grid existed (see prompt "Fallback на трапецию
 * byte-for-byte").
 */
export function buildShapeGrid(
  pts: Point2D[],
  rectangles: Rectangle[] | null,
  maxSpanMm: number | undefined,
): ShapeGrid | null {
  if (!rectangles || rectangles.length === 0) return null

  const n = pts.length
  const xWallsAbs: number[] = []
  const yWallsAbs: number[] = []

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const [x, y] of pts) {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }

  for (let i = 0; i < n; i++) {
    const A = pts[i]
    const B = pts[(i + 1) % n]
    const lenMm = Math.hypot(B[0] - A[0], B[1] - A[1])
    if (lenMm <= WING_EPS_MM) continue
    const dir: Point2D = [(B[0] - A[0]) / lenMm, (B[1] - A[1]) / lenMm]
    const isHorizontal = Math.abs(dir[1]) <= 1e-6
    const isVertical = Math.abs(dir[0]) <= 1e-6
    if (!isHorizontal && !isVertical) continue // not reached when rectangles != null (all edges are axis-aligned by construction)

    const localBoundariesMm = findWingBoundariesAlongSegment(A, B, rectangles)
    for (const distMm of localBoundariesMm) {
      if (isHorizontal) xWallsAbs.push(A[0] + distMm * dir[0])
      else yWallsAbs.push(A[1] + distMm * dir[1])
    }
  }

  xWallsAbs.push(minX, maxX)
  yWallsAbs.push(minY, maxY)

  const minSpacingMm = minPostSpacingMm(maxSpanMm)
  return {
    xGrid: buildAxisGrid(xWallsAbs, maxSpanMm, minSpacingMm),
    yGrid: buildAxisGrid(yWallsAbs, maxSpanMm, minSpacingMm),
  }
}
