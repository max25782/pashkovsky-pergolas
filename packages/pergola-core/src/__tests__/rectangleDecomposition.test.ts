import { describe, it, expect } from 'vitest'
import {
  decomposeIntoRectangles,
  buildShapeGrid,
  minPostSpacingMm,
  dropTooCloseToWalls,
  isOrthogonalContour,
  MIN_POST_SPACING_RATIO,
  DEFAULT_MIN_POST_SPACING_MM,
  type Rectangle,
} from '../rectangleDecomposition'
import { signedArea } from '../miter'
import type { Point2D } from '../types'

function rectArea(r: Rectangle): number {
  return (r.maxX - r.minX) * (r.maxY - r.minY)
}

function totalArea(rects: Rectangle[]): number {
  return rects.reduce((sum, r) => sum + rectArea(r), 0)
}

/** True iff two axis-aligned rectangles share any positive-area overlap (touching edges/corners are fine). */
function overlaps(a: Rectangle, b: Rectangle): boolean {
  const xOverlap = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)
  const yOverlap = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY)
  return xOverlap > 1e-6 && yOverlap > 1e-6
}

function expectNoOverlaps(rects: Rectangle[]) {
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      expect(overlaps(rects[i], rects[j])).toBe(false)
    }
  }
}

describe('decomposeIntoRectangles', () => {
  it('plain rectangle decomposes into exactly 1 rectangle — itself', () => {
    const contour: Point2D[] = [[0, 0], [8000, 0], [8000, 3000], [0, 3000]]
    const rects = decomposeIntoRectangles(contour)

    expect(rects).not.toBeNull()
    expect(rects).toHaveLength(1)
    expect(rects![0]).toEqual({ minX: 0, maxX: 8000, minY: 0, maxY: 3000 })
  })

  it('L-shape (one reflex vertex) decomposes into exactly 3 rectangles — corner block + two wings', () => {
    const contour: Point2D[] = [
      [0, 0], [6000, 0], [6000, 3000], [3000, 3000], [3000, 6000], [0, 6000],
    ]
    const rects = decomposeIntoRectangles(contour)

    expect(rects).not.toBeNull()
    expect(rects).toHaveLength(3)
    expect(rects).toContainEqual({ minX: 0, maxX: 3000, minY: 0, maxY: 3000 })
    expect(rects).toContainEqual({ minX: 3000, maxX: 6000, minY: 0, maxY: 3000 })
    expect(rects).toContainEqual({ minX: 0, maxX: 3000, minY: 3000, maxY: 6000 })

    // Coverage: total rectangle area equals polygon area (shoelace), no gaps.
    expect(totalArea(rects!)).toBeCloseTo(Math.abs(signedArea(contour)), 3)
    // No two rectangles overlap.
    expectNoOverlaps(rects!)
  })

  it('U-shape (two reflex vertices) decomposes into exactly 5 rectangles', () => {
    const contour: Point2D[] = [
      [0, 0], [9000, 0], [9000, 6000], [6000, 6000],
      [6000, 2000], [3000, 2000], [3000, 6000], [0, 6000],
    ]
    const rects = decomposeIntoRectangles(contour)

    expect(rects).not.toBeNull()
    expect(rects).toHaveLength(5)
    expect(totalArea(rects!)).toBeCloseTo(Math.abs(signedArea(contour)), 3)
    expectNoOverlaps(rects!)
  })

  it('trapezoid (non-orthogonal corner) returns null — signals fallback to node-based logic', () => {
    const contour: Point2D[] = [[0, 0], [8000, 0], [6000, 3000], [2000, 3000]]
    expect(decomposeIntoRectangles(contour)).toBeNull()
  })

  it('works regardless of input winding order (CW input is normalised internally)', () => {
    const ccw: Point2D[] = [[0, 0], [6000, 0], [6000, 3000], [3000, 3000], [3000, 6000], [0, 6000]]
    const cw = [...ccw].reverse()

    const rectsCcw = decomposeIntoRectangles(ccw)
    const rectsCw = decomposeIntoRectangles(cw)

    expect(rectsCcw).toHaveLength(3)
    expect(rectsCw).toHaveLength(3)
    expect(totalArea(rectsCw!)).toBeCloseTo(totalArea(rectsCcw!), 3)
  })

  it('U-shape rectangles individually match the expected grid cells (not just count/area)', () => {
    const contour: Point2D[] = [
      [0, 0], [9000, 0], [9000, 6000], [6000, 6000],
      [6000, 2000], [3000, 2000], [3000, 6000], [0, 6000],
    ]
    const rects = decomposeIntoRectangles(contour)!

    // Bottom band (y 0..2000) is solid across the full width — one rectangle per x-gap
    // the grid lines create (0..3000, 3000..6000, 6000..9000).
    expect(rects).toContainEqual({ minX: 0, maxX: 3000, minY: 0, maxY: 2000 })
    expect(rects).toContainEqual({ minX: 3000, maxX: 6000, minY: 0, maxY: 2000 })
    expect(rects).toContainEqual({ minX: 6000, maxX: 9000, minY: 0, maxY: 2000 })
    // Upper band (y 2000..6000): the notch (3000..6000) is cut away — only the two legs remain.
    expect(rects).toContainEqual({ minX: 0, maxX: 3000, minY: 2000, maxY: 6000 })
    expect(rects).toContainEqual({ minX: 6000, maxX: 9000, minY: 2000, maxY: 6000 })
    expect(rects).not.toContainEqual({ minX: 3000, maxX: 6000, minY: 2000, maxY: 6000 })
  })
})

describe('minPostSpacingMm — scales with the profile actually in use, not a fixed constant', () => {
  it('is a fraction of maxSpanMm when known', () => {
    expect(minPostSpacingMm(2000)).toBeCloseTo(2000 * MIN_POST_SPACING_RATIO, 6)
    expect(minPostSpacingMm(5000)).toBeCloseTo(5000 * MIN_POST_SPACING_RATIO, 6)
    // Different profiles get different absolute floors — not one shared constant.
    expect(minPostSpacingMm(2000)).not.toBeCloseTo(minPostSpacingMm(5000), 3)
  })

  it('falls back to DEFAULT_MIN_POST_SPACING_MM when maxSpanMm is unknown', () => {
    expect(minPostSpacingMm(undefined)).toBe(DEFAULT_MIN_POST_SPACING_MM)
    expect(minPostSpacingMm(0)).toBe(DEFAULT_MIN_POST_SPACING_MM)
    expect(minPostSpacingMm(-100)).toBe(DEFAULT_MIN_POST_SPACING_MM)
  })
})

describe('dropTooCloseToWalls — merge DROPS the offending candidate, never SHIFTS a coordinate', () => {
  it('drops a candidate within tolerance of a wall — the wall itself is untouched', () => {
    const walls = [0, 3000, 9000]
    const candidates = [3200, 6000] // 3200 is 200mm from the 3000 wall
    const kept = dropTooCloseToWalls(candidates, walls, 500)
    expect(kept).toEqual([6000]) // 3200 dropped outright, not moved onto 3000 or anywhere else
    expect(walls).toEqual([0, 3000, 9000]) // input wall array itself never mutated/shifted
  })

  it('keeps a candidate once it clears the tolerance — no shift needed', () => {
    const walls = [0, 3000, 9000]
    const candidates = [3600] // 600mm from 3000, clears a 500mm tolerance
    expect(dropTooCloseToWalls(candidates, walls, 500)).toEqual([3600])
  })

  it('also drops a candidate too close to an already-kept candidate (not just to a wall)', () => {
    const walls = [0, 9000]
    const candidates = [3000, 3300, 6000] // 3000 and 3300 are only 300mm apart
    const kept = dropTooCloseToWalls(candidates, walls, 500)
    expect(kept).toEqual([3000, 6000]) // 3300 dropped, 3000 (processed first, sorted) survives unmoved
  })
})

describe('buildShapeGrid — one shared per-axis grid, not a per-edge computation', () => {
  it('C-shape: xGrid intermediates come from the UNION of every horizontal edge, not one edge alone', () => {
    // Two reflex vertices at DIFFERENT x (3000 and 6000) — bottom's own wing
    // boundary set differs from top's (see diagnosis: bottom={3000}, top={3000,6000}).
    const contour: Point2D[] = [
      [0, 0], [9000, 0], [9000, 2000], [3000, 2000], [3000, 3000],
      [6000, 3000], [6000, 4000], [9000, 4000], [9000, 6000], [0, 6000],
    ]
    const rects = decomposeIntoRectangles(contour)
    const grid = buildShapeGrid(contour, rects, 2000)

    expect(grid).not.toBeNull()
    expect(grid!.xGrid.wallsMm).toEqual([0, 3000, 6000, 9000])
    expect(grid!.xGrid.intermediatesMm).toEqual([1500, 4500, 7500])
  })

  it('plain rectangle: walls = bounding box only, intermediates evenly fill maxSpanMm', () => {
    const contour: Point2D[] = [[0, 0], [9000, 0], [9000, 6000], [0, 6000]]
    const rects = decomposeIntoRectangles(contour)
    const grid = buildShapeGrid(contour, rects, 2000)

    expect(grid!.xGrid.wallsMm).toEqual([0, 9000])
    expect(grid!.xGrid.intermediatesMm).toEqual([1800, 3600, 5400, 7200])
    expect(grid!.yGrid.wallsMm).toEqual([0, 6000])
    expect(grid!.yGrid.intermediatesMm).toEqual([2000, 4000])
  })

  it('returns null for a non-orthogonal contour (trapezoid) — caller must fall back entirely', () => {
    const contour: Point2D[] = [[0, 0], [8000, 0], [6000, 3000], [2000, 3000]]
    const rects = decomposeIntoRectangles(contour)
    expect(rects).toBeNull()
    expect(buildShapeGrid(contour, rects, 2000)).toBeNull()
  })

  it('undefined maxSpanMm: walls still computed, intermediates empty (no subdivision requested)', () => {
    const contour: Point2D[] = [[0, 0], [9000, 0], [9000, 6000], [0, 6000]]
    const rects = decomposeIntoRectangles(contour)
    const grid = buildShapeGrid(contour, rects, undefined)

    expect(grid!.xGrid.wallsMm).toEqual([0, 9000])
    expect(grid!.xGrid.intermediatesMm).toEqual([])
  })
})

// ── isOrthogonalContour — see prompt "честная плашка для неортогональных
// форм": the strict, user-facing flag that drives the drawing sheets'
// "approximate" warning banner. Deliberately its OWN tolerance, separate
// from decomposeIntoRectangles's lenient (~3°) one — see the function's
// own docstring for why. As of prompt "плашка неортогональности ложно
// срабатывает", this tolerance is an ANGLE (±1°, length-independent), not
// a fixed mm epsilon — see STRICT_ORTHOGONAL_ANGLE_TOLERANCE_DEG's own
// docstring for the false-positive-on-long-edges bug this fixes. ─────────

describe('isOrthogonalContour', () => {
  it('plain rectangle → true', () => {
    const contour: Point2D[] = [[0, 0], [9000, 0], [9000, 6000], [0, 6000]]
    expect(isOrthogonalContour(contour)).toBe(true)
  })

  it('L-shape (all edges axis-aligned) → true', () => {
    const contour: Point2D[] = [
      [0, 0], [6000, 0], [6000, 3000], [3000, 3000], [3000, 6000], [0, 6000],
    ]
    expect(isOrthogonalContour(contour)).toBe(true)
  })

  it('trapezoid (two genuinely diagonal sides) → false', () => {
    const contour: Point2D[] = [[0, 0], [8000, 0], [6000, 3000], [2000, 3000]]
    expect(isOrthogonalContour(contour)).toBe(false)
  })

  it('L-shape with ONE diagonal side (real wall not square with the rest) → false', () => {
    const contour: Point2D[] = [
      [0, 0], [6000, 0], [6000, 3000], [3000, 3000], [2600, 6000], [0, 6000],
    ]
    expect(isOrthogonalContour(contour)).toBe(false)
  })

  it('edge tilted ~0.1° off vertical (interior angle 89.9°) on a SHORT edge → true (within the ±1° tolerance)', () => {
    // Right edge from (5000,0) up 3000mm, tilted 0.1° off vertical: dx ≈ 3000·tan(0.1°) ≈ 5.24mm.
    // See prompt "плашка неортогональности ложно срабатывает" — 89.9° is explicitly the
    // "in tolerance" boundary case: this is realistic hand-drawn/mouse slop, not a real
    // diagonal wall, and must NOT trip the warning banner.
    const dx = 3000 * Math.tan((0.1 * Math.PI) / 180)
    const contour: Point2D[] = [[0, 0], [5000, 0], [5000 + dx, 3000], [0, 3000]]
    expect(isOrthogonalContour(contour)).toBe(true)
  })

  it('same ~0.1° tilt on a LONG (8500mm) edge → still true — the tolerance is an ANGLE, not a fixed mm epsilon', () => {
    // See prompt's own root-cause hypothesis: a fixed mm epsilon independent of edge
    // length made a realistically-sized hand-drawn contour fail this check just because
    // the edge was long, even though the ANGULAR deviation (the only thing that actually
    // matters for "is this corner square") was the same tiny amount as on a short edge.
    const dx = 8500 * Math.tan((0.1 * Math.PI) / 180)
    const contour: Point2D[] = [[0, 0], [5000, 0], [5000, 6000], [5000 + dx, 6000 + 8500], [0, 6000 + 8500]]
    expect(isOrthogonalContour(contour)).toBe(true)
  })

  it('edge tilted 2° off vertical (interior angle 88°) → false — noticeably diagonal, outside the ±1° tolerance', () => {
    // See prompt's own boundary case: "сторона под 88° (заметно косая, вне допуска) →
    // неортогональная, плашка есть".
    const dx = 3000 * Math.tan((2 * Math.PI) / 180)
    const contour: Point2D[] = [[0, 0], [5000, 0], [5000 + dx, 3000], [0, 3000]]
    expect(isOrthogonalContour(contour)).toBe(false)
  })

  it('edge tilted exactly at the 1° tolerance boundary → true (inclusive)', () => {
    const dx = 4000 * Math.tan((1 * Math.PI) / 180)
    const contour: Point2D[] = [[0, 0], [5000, 0], [5000 + dx, 4000], [0, 4000]]
    expect(isOrthogonalContour(contour)).toBe(true)
  })

  it('L-shape with realistic hand-drawn corner slop on EVERY edge (all within ±1°) → true, no false banner', () => {
    // Mirrors the bug report: a rectangular L-shape drawn by mouse, where every corner
    // is close to but not exactly 90° — must not show the "approximate" banner.
    const tiltMm = (lenMm: number) => lenMm * Math.tan((0.5 * Math.PI) / 180)
    const contour: Point2D[] = [
      [0, 0],
      [9000, tiltMm(9000)],
      [9000 - tiltMm(4054), 4054],
      [5000, 4054 + tiltMm(1000)],
      [5000 + tiltMm(4446), 8500],
      [0, 8500],
    ]
    expect(isOrthogonalContour(contour)).toBe(true)
  })

  it('float noise well under the tolerance does not trip the flag', () => {
    const contour: Point2D[] = [[0, 0], [9000, 0.0004], [9000.0003, 6000], [0, 6000]]
    expect(isOrthogonalContour(contour)).toBe(true)
  })
})
