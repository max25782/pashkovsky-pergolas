import { describe, it, expect } from 'vitest'
import { computeContourMiters, signedArea, isCCW } from '../miter'
import type { Point2D } from '../types'

// ── Rectangle 3000 × 4000 mm ──────────────────────────────────────────────────
describe('rectangle 3000×4000', () => {
  const rect: Point2D[] = [[0, 0], [3000, 0], [3000, 4000], [0, 4000]]

  it('is CCW', () => {
    expect(signedArea(rect)).toBeGreaterThan(0)
    expect(isCCW(rect)).toBe(true)
  })

  it('all 4 interior angles = 90°, miter = 45°', () => {
    const m = computeContourMiters(rect)
    expect(m).toHaveLength(4)
    m.forEach((v) => {
      expect(v.interiorAngleDeg).toBeCloseTo(90, 1)
      expect(v.miterAngleDeg).toBeCloseTo(45, 1)
      expect(v.isConvex).toBe(true)
    })
  })

  it('accepts CW input and normalises to CCW before computing', () => {
    // Reverse = CW winding
    const cw: Point2D[] = [[0, 4000], [3000, 4000], [3000, 0], [0, 0]]
    expect(isCCW(cw)).toBe(false)
    const m = computeContourMiters(cw)
    m.forEach((v) => {
      expect(v.miterAngleDeg).toBeCloseTo(45, 1)
      expect(v.isConvex).toBe(true)
    })
  })

  it('throws on fewer than 3 vertices', () => {
    expect(() => computeContourMiters([[0, 0], [1000, 0]])).toThrow()
  })
})

// ── Symmetric trapeze ─────────────────────────────────────────────────────────
//
//   D(1000,3000) ─────── C(4000,3000)   top  3000 mm
//    \                          /
//     \                        /        height 3000 mm
//      \                      /
//   A(0,0) ─────────── B(5000,0)        base 5000 mm
//
// Slant from vertical: atan(1000/3000) = 18.43°
// Bottom corners (A,B): interior = 71.57°, miter = 54.22°
// Top corners (C,D):    interior = 108.43°, miter = 35.78°
// Adjacent bottom+top angles are supplementary: 71.57 + 108.43 = 180°
// Adjacent miters sum to 90°: 54.22 + 35.78 = 90°
//
describe('symmetric trapeze', () => {
  const trap: Point2D[] = [[0, 0], [5000, 0], [4000, 3000], [1000, 3000]]

  it('is CCW', () => {
    expect(isCCW(trap)).toBe(true)
  })

  it('all 4 vertices are convex', () => {
    computeContourMiters(trap).forEach((v) => {
      expect(v.isConvex).toBe(true)
    })
  })

  it('bottom-left corner A: interior ≈ 71.57°, miter ≈ 54.22°', () => {
    const [A] = computeContourMiters(trap)
    expect(A.interiorAngleDeg).toBeCloseTo(71.57, 1)
    expect(A.miterAngleDeg).toBeCloseTo(54.22, 1)
  })

  it('bottom-right corner B: same as A (symmetric)', () => {
    const [, B] = computeContourMiters(trap)
    expect(B.interiorAngleDeg).toBeCloseTo(71.57, 1)
    expect(B.miterAngleDeg).toBeCloseTo(54.22, 1)
  })

  it('top-right corner C: interior ≈ 108.43°, miter ≈ 35.78°', () => {
    const [, , C] = computeContourMiters(trap)
    expect(C.interiorAngleDeg).toBeCloseTo(108.43, 1)
    expect(C.miterAngleDeg).toBeCloseTo(35.78, 1)
  })

  it('top-left corner D: same as C (symmetric)', () => {
    const [, , , D] = computeContourMiters(trap)
    expect(D.interiorAngleDeg).toBeCloseTo(108.43, 1)
    expect(D.miterAngleDeg).toBeCloseTo(35.78, 1)
  })

  it('adjacent bottom + top interior angles are supplementary (sum = 180°)', () => {
    const [A, , C] = computeContourMiters(trap)
    expect(A.interiorAngleDeg + C.interiorAngleDeg).toBeCloseTo(180, 1)
  })

  it('adjacent bottom + top miter angles sum to 90°', () => {
    const [A, , C] = computeContourMiters(trap)
    expect(A.miterAngleDeg + C.miterAngleDeg).toBeCloseTo(90, 1)
  })
})

// ── L-shape with one concave (reflex) vertex ──────────────────────────────────
//
//   F(0,4000) ──── E(2000,4000)
//   |              |
//   |              D(2000,2000) ← reflex, interior = 270°, miter = −45°
//   |                        \
//   |                    C(4000,2000)
//   |                         |
//   A(0,0) ────────── B(4000,0)
//
// Outer corners: interior = 90°, miter = 45°
// Inner corner D: interior = 270°, miter = −45°
//
describe('L-shape with concave vertex', () => {
  const lShape: Point2D[] = [
    [0, 0],       // A — index 0
    [4000, 0],    // B — index 1
    [4000, 2000], // C — index 2
    [2000, 2000], // D — index 3 (reflex)
    [2000, 4000], // E — index 4
    [0, 4000],    // F — index 5
  ]

  it('is CCW', () => {
    expect(isCCW(lShape)).toBe(true)
  })

  it('reflex vertex D at (2000,2000): interior = 270°, miter = −45°', () => {
    const miters = computeContourMiters(lShape)
    const D = miters[3]
    expect(D.isConvex).toBe(false)
    expect(D.interiorAngleDeg).toBeCloseTo(270, 1)
    expect(D.miterAngleDeg).toBeCloseTo(-45, 1)
  })

  it('all 5 outer corners have interior = 90°, miter = 45°', () => {
    const miters = computeContourMiters(lShape)
    const outerIndices = [0, 1, 2, 4, 5]
    outerIndices.forEach((i) => {
      expect(miters[i].isConvex).toBe(true)
      expect(miters[i].interiorAngleDeg).toBeCloseTo(90, 1)
      expect(miters[i].miterAngleDeg).toBeCloseTo(45, 1)
    })
  })
})

// ── Edge-case: straight line vertex (interior = 180°) ────────────────────────
//
// A vertex that lies on a straight edge between its neighbours
// should yield interior = 180° and miter = 0° (no cut needed).
//
describe('degenerate straight vertex', () => {
  // Rectangle with a redundant midpoint on the bottom edge
  const withMidpoint: Point2D[] = [
    [0, 0], [1500, 0], [3000, 0], [3000, 4000], [0, 4000]
  ]

  it('midpoint vertex at (1500,0) has interior ≈ 180°, miter ≈ 0°', () => {
    const m = computeContourMiters(withMidpoint)
    const mid = m[1] // vertex (1500,0)
    expect(mid.interiorAngleDeg).toBeCloseTo(180, 1)
    expect(mid.miterAngleDeg).toBeCloseTo(0, 1)
    expect(mid.cutHandIncoming).toBe('straight')
    expect(mid.cutHandOutgoing).toBe('straight')
  })
})
