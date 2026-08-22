import { describe, it, expect } from 'vitest'
import { sanitizeContour } from '../contourSanitize'
import { decomposeIntoRectangles } from '../rectangleDecomposition'
import type { Point2D } from '../types'

describe('sanitizeContour', () => {
  it('drops a duplicate consecutive vertex, and decomposeIntoRectangles on the cleaned L-shape gives 3 rectangles (raw contour breaks decomposition entirely)', () => {
    // A clean L-shape (right wing hangs down — same family as previous
    // wing-boundary investigations) with an accidental duplicate vertex
    // injected at the reflex corner — e.g. two clicks landing on the exact
    // same coordinates while drawing (or a numeric length committed as
    // ~0mm, see EdgeEditor.tsx/SizesPanel.tsx).
    const dirty: Point2D[] = [
      [6000, 6000],
      [0, 6000],
      [0, 3000],
      [3000, 3000],
      [3000, 3000], // exact duplicate of the previous vertex — zero-length side
      [3000, 0],
      [6000, 0],
    ]

    const cleaned = sanitizeContour(dirty)
    expect(cleaned).toEqual([
      [6000, 6000],
      [0, 6000],
      [0, 3000],
      [3000, 3000],
      [3000, 0],
      [6000, 0],
    ])

    // The regression this exists to prevent: a zero-length side makes
    // classifyEdgeAxis (rectangleDecomposition.ts) return null for that one
    // edge, which makes regularizeNearOrthogonalContour — and therefore
    // decomposeIntoRectangles — bail out for the WHOLE contour. computeFrame
    // then loses buildShapeGrid entirely and falls back to the non-orthogonal,
    // whole-edge-span behaviour (no per-wing carve-out), which is exactly how
    // a division line leaks into a wing that should have clipped it.
    expect(decomposeIntoRectangles(dirty)).toBeNull()

    // On the cleaned contour, the real 3-rectangle L-shape decomposition comes back.
    const rectsClean = decomposeIntoRectangles(cleaned)
    expect(rectsClean).not.toBeNull()
    expect(rectsClean!.length).toBe(3)
  })

  it('drops a zero-length side (exact duplicate coordinates)', () => {
    const dirty: Point2D[] = [
      [0, 0],
      [4000, 0],
      [4000, 0], // exact duplicate — zero-length side
      [4000, 3000],
      [0, 3000],
    ]
    const cleaned = sanitizeContour(dirty)
    expect(cleaned).toEqual([
      [0, 0],
      [4000, 0],
      [4000, 3000],
      [0, 3000],
    ])
  })

  it('drops a zero-length side at the wrap-around (last vertex duplicates the first)', () => {
    const dirty: Point2D[] = [
      [0, 0],
      [4000, 0],
      [4000, 3000],
      [0, 3000],
      [0, 0.1], // duplicates the first vertex
    ]
    const cleaned = sanitizeContour(dirty)
    expect(cleaned).toEqual([
      [0, 0],
      [4000, 0],
      [4000, 3000],
      [0, 3000],
    ])
  })

  it('collapses a redundant collinear middle vertex (three points on a line)', () => {
    const dirty: Point2D[] = [
      [0, 0],
      [2000, 0],
      [4000, 0], // collinear with (0,0) and (6000,0) — a straight edge accidentally split into two clicks
      [6000, 0],
      [6000, 3000],
      [0, 3000],
    ]
    const cleaned = sanitizeContour(dirty)
    expect(cleaned).toEqual([
      [0, 0],
      [6000, 0],
      [6000, 3000],
      [0, 3000],
    ])
  })

  it('collapses a run of more than one redundant collinear vertex in a single pass', () => {
    const dirty: Point2D[] = [
      [0, 0],
      [1500, 0],
      [3000, 0],
      [4500, 0],
      [6000, 0],
      [6000, 3000],
      [0, 3000],
    ]
    const cleaned = sanitizeContour(dirty)
    expect(cleaned).toEqual([
      [0, 0],
      [6000, 0],
      [6000, 3000],
      [0, 3000],
    ])
  })

  it('does NOT collapse a genuine corner (non-collinear) even when short', () => {
    const cleanLShape: Point2D[] = [
      [6000, 6000],
      [0, 6000],
      [0, 3000],
      [3000, 3000],
      [3000, 0],
      [6000, 0],
    ]
    expect(sanitizeContour(cleanLShape)).toEqual(cleanLShape)
  })

  it('regression: an already-clean contour is returned unchanged', () => {
    const rectangle: Point2D[] = [
      [0, 0],
      [6000, 0],
      [6000, 4000],
      [0, 4000],
    ]
    expect(sanitizeContour(rectangle)).toEqual(rectangle)

    const trapeze: Point2D[] = [
      [0, 0],
      [6000, 0],
      [4500, 4000],
      [1500, 4000],
    ]
    expect(sanitizeContour(trapeze)).toEqual(trapeze)
  })

  it('does not collapse a real spike (reversal) that only coincidentally lies on the same line', () => {
    // curr lies on the infinite line through prev/next but OUTSIDE the
    // prev→next segment (a doubling-back spike) — must be kept, not dropped,
    // since removing it would silently change the polygon's shape.
    const withSpike: Point2D[] = [
      [0, 0],
      [8000, 0], // "curr" — beyond "next" along the same line, not between prev and next
      [4000, 0],
      [4000, 3000],
      [0, 3000],
    ]
    const cleaned = sanitizeContour(withSpike)
    expect(cleaned).toEqual(withSpike)
  })

  it('leaves contours with fewer than 3 vertices untouched', () => {
    const line: Point2D[] = [[0, 0], [1000, 0]]
    expect(sanitizeContour(line)).toEqual(line)
  })
})
