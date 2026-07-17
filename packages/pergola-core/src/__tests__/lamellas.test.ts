import { describe, it, expect } from 'vitest'
import { computeLamellas, cutAtEdge, longPointOffset } from '../lamellas'
import type { PergolaSpec, ProfileDimensions, Point2D } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROFILE_W = 80   // mm — width (horizontal, perpendicular to lamella direction)
const PROFILE_H = 25   // mm — height (vertical face)

const PROFILE: ProfileDimensions = { widthMm: PROFILE_W, heightMm: PROFILE_H }
const PROFILES: Map<string, ProfileDimensions> = new Map([['lam-80', PROFILE]])

function baseSpec(overrides: Partial<PergolaSpec> = {}): PergolaSpec {
  return {
    contour: [],
    lamellaDirectionDeg: 0,     // horizontal, running along +X
    lamellaGapMm: 500,
    lamellaAngleDeg: 0,         // flat (horizontal)
    heightMm: 3000,
    color: '#FFFFFF',
    lamellaProfileId: 'lam-80',
    ...overrides,
  }
}

const near = (a: number, b: number, eps = 0.5) =>
  expect(Math.abs(a - b)).toBeLessThan(eps)

// ── 1. Rectangle ──────────────────────────────────────────────────────────────

describe('rectangle — horizontal lamellae', () => {
  /*
   *  (0,0) ─── (3000,0)
   *   |                |
   *  (0,4000) ── (3000,4000)
   *
   *  CW input → auto-normalised to CCW.
   *  lamellaDir = +X; perp = +Y.
   *  8 scan lines at Y = 250, 750, 1250, 1750, 2250, 2750, 3250, 3750
   *  Each runs full width 3000 mm.
   *  Left/right edges are ⊥ to lamella dir → straight cuts (0°).
   */
  const contour: Point2D[] = [
    [0, 0], [3000, 0], [3000, 4000], [0, 4000],   // CW input
  ]
  const spec = baseSpec({ contour, lamellaDirectionDeg: 0, lamellaGapMm: 500 })
  const pieces = computeLamellas(spec, PROFILES)

  it('produces 8 lamellae', () => expect(pieces).toHaveLength(8))

  it('all axis lengths are 3000 mm', () => {
    pieces.forEach(p => near(p.lengthAxisMm, 3000))
  })

  it('all miter cuts are straight (0°)', () => {
    pieces.forEach(p => {
      near(p.cutMiterStartDeg, 0, 0.01)
      near(p.cutMiterEndDeg,   0, 0.01)
    })
  })

  it('horizontal lamellae → bevel = lamellaAngleDeg = 0', () => {
    pieces.forEach(p => {
      near(p.cutBevelStartDeg, 0, 0.01)
      near(p.cutBevelEndDeg,   0, 0.01)
    })
  })

  it('hand = straight for all', () => {
    pieces.forEach(p => {
      expect(p.cutHandStart).toBe('straight')
      expect(p.cutHandEnd).toBe('straight')
    })
  })

  it('straight cuts → lengthLong = lengthShort = lengthAxis', () => {
    pieces.forEach(p => {
      near(p.lengthLongMm,  3000)
      near(p.lengthShortMm, 3000)
    })
  })
})

// ── 2. Symmetric trapeze — three lengths + miter angles ───────────────────────

describe('symmetric trapeze — miter cuts + three lengths', () => {
  /*
   *  Wide base: Y=0 x=[0,3000]
   *  Narrow top: Y=9000 x=[1000,2000]
   *  Slants: A(0,0)→D(1000,9000) and B(3000,0)→C(2000,9000)
   *
   *  Left slant direction A→D: (1000,9000)/√82 ≈ (0.1104, 0.9938)
   *  α_m = asin(|dot((1,0), (1,9)/√82)|) = asin(1/√82) ≈ 6.34°
   */
  const A: Point2D = [0, 0]
  const B: Point2D = [3000, 0]
  const C: Point2D = [2000, 9000]
  const D: Point2D = [1000, 9000]
  const contour: Point2D[] = [A, B, C, D]  // CCW already
  const spec = baseSpec({ contour, lamellaDirectionDeg: 0, lamellaGapMm: 1000 })
  const pieces = computeLamellas(spec, PROFILES)

  const PLAN_ALPHA_DEG = Math.asin(1 / Math.sqrt(82)) * (180 / Math.PI) // ≈6.34°

  it('produces 9 lamellae', () => {
    expect(pieces).toHaveLength(9)
  })

  it('axis lengths decrease from ~2889 mm to ~111 mm', () => {
    near(pieces[0].lengthAxisMm, 3000 - 2 * 500 / 9, 10)
    near(pieces[8].lengthAxisMm, 3000 - 2 * 8500 / 9, 10)
  })

  it('all miter angles ≈ plan_alpha_deg', () => {
    pieces.forEach(p => {
      near(p.cutMiterStartDeg, PLAN_ALPHA_DEG, 0.1)
      near(p.cutMiterEndDeg,   PLAN_ALPHA_DEG, 0.1)
    })
  })

  it('bevel = lamellaAngleDeg = 0 for horizontal lamellae', () => {
    pieces.forEach(p => {
      near(p.cutBevelStartDeg, 0, 0.01)
      near(p.cutBevelEndDeg,   0, 0.01)
    })
  })

  it('three-length ordering: lengthLong > lengthAxis > lengthShort', () => {
    pieces.forEach(p => {
      expect(p.lengthLongMm).toBeGreaterThan(p.lengthAxisMm)
      expect(p.lengthAxisMm).toBeGreaterThan(p.lengthShortMm)
    })
  })

  it('lengthLong − lengthShort ≈ profileWidth × (tan α_start + tan α_end)', () => {
    const tan_α = Math.tan(PLAN_ALPHA_DEG * Math.PI / 180)
    const expected = PROFILE_W * (tan_α + tan_α)
    pieces.forEach(p => {
      near(p.lengthLongMm - p.lengthShortMm, expected, 0.1)
    })
  })
})

// ── 3. Steeper trapeze — 18.43° (user's example) ──────────────────────────────

describe('steeper trapeze — 18.43° example', () => {
  /*
   *  Base Y=0 x=[0,5000], Top Y=3000 x=[1000,4000], rise=3000, run=1000
   *  Left slant: (1,3)/√10  →  α_m = asin(1/√10) ≈ 18.43°
   *
   *  User formula: 80 × 2 × tan(18.43°) ≈ 53 mm
   */
  const contour: Point2D[] = [
    [0, 0], [5000, 0], [4000, 3000], [1000, 3000],
  ]
  const spec = baseSpec({ contour, lamellaDirectionDeg: 0, lamellaGapMm: 500 })
  const pieces = computeLamellas(spec, PROFILES)

  const ALPHA = Math.asin(1 / Math.sqrt(10)) * (180 / Math.PI) // ≈18.43°
  const tan_α = Math.tan(ALPHA * Math.PI / 180)

  it('miter angles ≈ 18.43° on all pieces', () => {
    pieces.forEach(p => {
      near(p.cutMiterStartDeg, ALPHA, 0.05)
      near(p.cutMiterEndDeg,   ALPHA, 0.05)
    })
  })

  it('three-length ordering holds', () => {
    pieces.forEach(p => {
      expect(p.lengthLongMm).toBeGreaterThan(p.lengthAxisMm)
      expect(p.lengthAxisMm).toBeGreaterThan(p.lengthShortMm)
    })
  })

  it('lengthLong − lengthShort ≈ 80 × 2 × tan(18.43°) ≈ 53 mm', () => {
    const expected = PROFILE_W * 2 * tan_α  // ≈53.3 mm
    pieces.forEach(p => {
      near(p.lengthLongMm - p.lengthShortMm, expected, 1.0)
    })
  })
})

// ── 4. U-shape — multi-segment lamellae ───────────────────────────────────────

describe('U-shape — multi-segment lamellae', () => {
  /*
   *  Outer rect (0,0)−(6000,8000) with top-centre notch removed:
   *  (0,0) → (6000,0) → (6000,8000) → (4000,8000) →
   *  (4000,4000) → (2000,4000) → (2000,8000) → (0,8000)
   *
   *  Lamella +X direction:
   *    Y < 4000 → one 6000mm piece
   *    Y > 4000 → two 2000mm pieces
   */
  const contour: Point2D[] = [
    [0, 0], [6000, 0], [6000, 8000], [4000, 8000],
    [4000, 4000], [2000, 4000], [2000, 8000], [0, 8000],
  ]
  const spec = baseSpec({ contour, lamellaDirectionDeg: 0, lamellaGapMm: 1000 })
  const pieces = computeLamellas(spec, PROFILES)

  it('segments below the notch are ≈6000 mm, above are ≈2000 mm', () => {
    const belowNotch = pieces.filter(p => p.position[2] < 4000)
    const aboveNotch = pieces.filter(p => p.position[2] >= 4000)
    belowNotch.forEach(p => near(p.lengthAxisMm, 6000, 1))
    aboveNotch.forEach(p => near(p.lengthAxisMm, 2000, 1))
  })

  it('all cuts straight (all edges are ⊥ to +X direction)', () => {
    pieces.forEach(p => {
      near(p.cutMiterStartDeg, 0, 0.01)
      near(p.cutMiterEndDeg,   0, 0.01)
    })
  })
})

// ── 5. Tilted lamellae — bevel ≠ 0 ───────────────────────────────────────────

describe('tilted lamellae — bevel = lamellaAngleDeg', () => {
  /*
   *  Same steeper trapeze (18.43° slant) with lamellaAngleDeg = 30°.
   *
   *  Physical model (slot perpendicular to beam in 3D, at tilt β):
   *    cutMiterDeg = α_m = 18.43°   (plan angle, unchanged by β)
   *    cutBevelDeg = β   = 30.0°    (lamella tilt, same for all edges)
   *
   *  This matches the user's cut-sheet example:
   *    "Стол 18.4° ВЛЕВО, диск 30.0°"
   */
  const contour: Point2D[] = [
    [0, 0], [5000, 0], [4000, 3000], [1000, 3000],
  ]
  const BETA = 30
  const spec = baseSpec({ contour, lamellaDirectionDeg: 0, lamellaGapMm: 500, lamellaAngleDeg: BETA })
  const pieces = computeLamellas(spec, PROFILES)

  const ALPHA = Math.asin(1 / Math.sqrt(10)) * (180 / Math.PI)  // 18.43°

  it('miter = plan angle (18.43°), UNCHANGED by lamella tilt', () => {
    pieces.forEach(p => {
      near(p.cutMiterStartDeg, ALPHA, 0.05)
      near(p.cutMiterEndDeg,   ALPHA, 0.05)
    })
  })

  it('bevel = lamellaAngleDeg = 30°', () => {
    pieces.forEach(p => {
      near(p.cutBevelStartDeg, BETA, 0.01)
      near(p.cutBevelEndDeg,   BETA, 0.01)
    })
  })

  it('bevel is non-zero (regression: tilted lamella must have bevel)', () => {
    pieces.forEach(p => {
      expect(p.cutBevelStartDeg).toBeGreaterThan(1)
      expect(p.cutBevelEndDeg).toBeGreaterThan(1)
    })
  })

  it('three-length ordering still holds (miter-based)', () => {
    pieces.forEach(p => {
      expect(p.lengthLongMm).toBeGreaterThan(p.lengthAxisMm)
      expect(p.lengthAxisMm).toBeGreaterThan(p.lengthShortMm)
    })
  })

  it('horizontal lamella (β=0) → bevel = 0 (regression)', () => {
    const flatSpec = baseSpec({ contour, lamellaDirectionDeg: 0, lamellaGapMm: 500, lamellaAngleDeg: 0 })
    const flatPieces = computeLamellas(flatSpec, PROFILES)
    flatPieces.forEach(p => {
      near(p.cutBevelStartDeg, 0, 0.01)
      near(p.cutBevelEndDeg,   0, 0.01)
    })
  })

  it('tilted lamella on perpendicular edge → miter=0, bevel=β', () => {
    /*
     *  For an edge perpendicular to the lamella direction, the cut is a
     *  straight cross-cut in plan (miter=0) but the slot is still tilted at β,
     *  so bevel = β.
     */
    const rect: Point2D[] = [[0,0],[5000,0],[5000,4000],[0,4000]]
    const rectSpec = baseSpec({ contour: rect, lamellaAngleDeg: BETA, lamellaGapMm: 1000 })
    const rectPieces = computeLamellas(rectSpec, PROFILES)
    rectPieces.forEach(p => {
      near(p.cutMiterStartDeg, 0, 0.01)
      near(p.cutMiterEndDeg,   0, 0.01)
      near(p.cutBevelStartDeg, BETA, 0.01)
      near(p.cutBevelEndDeg,   BETA, 0.01)
    })
  })
})

// ── 6. Tangent-to-vertex boundary case ───────────────────────────────────────

describe('tangent-to-vertex — no degenerate pieces', () => {
  const contour: Point2D[] = [[0, 0], [4000, 0], [2000, 4000]]
  const spec = baseSpec({ contour, lamellaDirectionDeg: 0, lamellaGapMm: 100 })
  const pieces = computeLamellas(spec, PROFILES)

  it('no piece has lengthAxisMm ≤ 0', () => {
    pieces.forEach(p => expect(p.lengthAxisMm).toBeGreaterThan(0))
  })
  it('no piece has lengthLongMm < lengthShortMm', () => {
    pieces.forEach(p => expect(p.lengthLongMm).toBeGreaterThanOrEqual(p.lengthShortMm))
  })
  it('all pieces have positive lengthLongMm', () => {
    pieces.forEach(p => expect(p.lengthLongMm).toBeGreaterThan(0))
  })
})

// ── 7. cutAtEdge unit tests ───────────────────────────────────────────────────

describe('cutAtEdge unit tests', () => {
  const RECT_CCW: Point2D[] = [[0, 0], [3000, 0], [3000, 4000], [0, 4000]]
  const lamellaDir: [number, number] = [1, 0]

  it('right edge (edge 1, edgeDir ⊥ lamellaDir) → straight, miter=0', () => {
    const { cutMiterDeg, cutHand } = cutAtEdge(lamellaDir, RECT_CCW, 1)
    near(cutMiterDeg, 0, 0.01)
    expect(cutHand).toBe('straight')
  })

  it('left edge (edge 3, edgeDir ⊥ lamellaDir) → straight, miter=0', () => {
    const { cutMiterDeg, cutHand } = cutAtEdge(lamellaDir, RECT_CCW, 3)
    near(cutMiterDeg, 0, 0.01)
    expect(cutHand).toBe('straight')
  })

  it('trapeze slant edge → miter ≈ 18.43°', () => {
    const trap: Point2D[] = [[0, 0], [5000, 0], [4000, 3000], [1000, 3000]]
    const { cutMiterDeg } = cutAtEdge(lamellaDir, trap, 1)  // right slant: (5000,0)→(4000,3000)
    near(cutMiterDeg, 18.43, 0.1)
  })

  it('both slant edges of trapeze produce same miter angle (symmetric)', () => {
    const trap: Point2D[] = [[0, 0], [5000, 0], [4000, 3000], [1000, 3000]]
    const right = cutAtEdge(lamellaDir, trap, 1)  // (5000,0)→(4000,3000)
    const left  = cutAtEdge(lamellaDir, trap, 3)  // (1000,3000)→(0,0)
    near(right.cutMiterDeg, left.cutMiterDeg, 0.01)
  })
})

// ── 8. longPointOffset unit tests ─────────────────────────────────────────────

describe('longPointOffset', () => {
  it('straight cut (0°) → offset = 0', () => {
    near(longPointOffset(0, 80), 0, 0.001)
  })

  it('18.43° miter, 80mm profile → tan(18.43°)×40 ≈ 13.3 mm', () => {
    near(longPointOffset(18.43, 80), Math.tan(18.43 * Math.PI / 180) * 40, 0.05)
  })

  it('45° miter, 80mm profile → 40 mm', () => {
    near(longPointOffset(45, 80), 40, 0.01)
  })

  it('larger miter → larger offset', () => {
    expect(longPointOffset(30, 80)).toBeGreaterThan(longPointOffset(18.43, 80))
  })
})
