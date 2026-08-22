import { describe, it, expect } from 'vitest'
import { computeLamellas, cutAtEdge, longPointOffset } from '../lamellas'
import { computePurlins } from '../purlins'
import type { PergolaSpec, ProfileDimensions, Point2D } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROFILE_W = 80   // mm — width (horizontal, perpendicular to lamella direction)
const PROFILE_H = 25   // mm — height (vertical face)

const PROFILE: ProfileDimensions = { widthMm: PROFILE_W, heightMm: PROFILE_H }
const PROFILES: Map<string, ProfileDimensions> = new Map([['lam-80', PROFILE]])

/**
 * All fixtures below predate the pitch-bug fix (pitch = profile.widthMm +
 * lamellaGapMm; old code used lamellaGapMm alone). They pass `lamellaGapMm`
 * values that were the INTENDED PITCH under the old (buggy) semantics —
 * converted here to `desiredPitch - PROFILE_W` so every fixture keeps its
 * original pitch (and therefore its original row count/positions/lengths)
 * under the fixed formula. This is deliberate: these tests exercise miter/
 * bevel/three-length math, not the pitch formula itself — that gets its own
 * dedicated tests below (section 0). See prompt "ламели — сплошная плита".
 */
function pitchToGapMm(desiredPitchMm: number): number {
  return desiredPitchMm - PROFILE_W
}

function baseSpec(overrides: Partial<PergolaSpec> = {}): PergolaSpec {
  return {
    contour: [],
    lamellaDirectionDeg: 0,     // horizontal, running along +X
    lamellaGapMm: 500,
    lamellaAngleDeg: 0,         // flat (horizontal)
    heightMm: 3000,
    color: '#FFFFFF',
    // computeLamellas only ever reads lamellaProfileId/purlinProfileId — the
    // other two are irrelevant to every test in this file, but PergolaSpec
    // requires them (computeFrame's contract). Pre-existing gap (this
    // helper never set them, unlike frame.test.ts's) surfaced by `tsc
    // --noEmit`, unrelated to the purlin/pitch work below — fixed in passing.
    postProfileId: 'post-unused',
    beamProfileId: 'beam-unused',
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
  const spec = baseSpec({ contour, lamellaDirectionDeg: 0, lamellaGapMm: pitchToGapMm(500) })
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
  const spec = baseSpec({ contour, lamellaDirectionDeg: 0, lamellaGapMm: pitchToGapMm(1000) })
  const pieces = computeLamellas(spec, PROFILES)

  const PLAN_ALPHA_DEG = Math.asin(1 / Math.sqrt(82)) * (180 / Math.PI) // ≈6.34°

  it('produces 9 lamellae', () => {
    expect(pieces).toHaveLength(9)
  })

  it('axis lengths decrease with row position (row Y = width/2 + k×pitch, pitch preserved at 1000mm)', () => {
    // Row Y-offset changed with the pitch-bug fix: first row now starts at
    // tMin + PROFILE_W/2 = 40 (flush with the contour edge), not the old
    // tMin + gap/2 = 500 — see "lamella pitch" describe block above. Pitch
    // itself (1000mm) is preserved via pitchToGapMm, so row k sits at
    // Y = 40 + k×1000, and width(Y) = 3000 − 2×Y/9 (trapeze narrows
    // linearly from 3000 at Y=0 to 1000 over the 9000mm height).
    const rowOffset = PROFILE_W / 2
    const pitch = 1000
    near(pieces[0].lengthAxisMm, 3000 - 2 * rowOffset / 9, 10)
    near(pieces[8].lengthAxisMm, 3000 - 2 * (rowOffset + 8 * pitch) / 9, 10)
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
  const spec = baseSpec({ contour, lamellaDirectionDeg: 0, lamellaGapMm: pitchToGapMm(500) })
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
  const spec = baseSpec({ contour, lamellaDirectionDeg: 0, lamellaGapMm: pitchToGapMm(1000) })
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
  const spec = baseSpec({ contour, lamellaDirectionDeg: 0, lamellaGapMm: pitchToGapMm(500), lamellaAngleDeg: BETA })
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
    const flatSpec = baseSpec({ contour, lamellaDirectionDeg: 0, lamellaGapMm: pitchToGapMm(500), lamellaAngleDeg: 0 })
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
    const rectSpec = baseSpec({ contour: rect, lamellaAngleDeg: BETA, lamellaGapMm: pitchToGapMm(1000) })
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
  const spec = baseSpec({ contour, lamellaDirectionDeg: 0, lamellaGapMm: pitchToGapMm(100) })
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

// ── 9. Pitch bug fix — pitch = profile.widthMm + lamellaGapMm ────────────────

describe('lamella pitch = profile.widthMm + lamellaGapMm (bug fix)', () => {
  /*
   *  Prompt's own worked example: 70mm-wide profile, 20mm gap → adjacent
   *  centre lines exactly 90mm apart. The OLD code used lamellaGapMm (20mm)
   *  directly as the pitch, ignoring the 70mm profile width entirely — rows
   *  overlapped by 50mm and rendered as one solid slab instead of slats.
   */
  const WIDE_PROFILE: ProfileDimensions = { widthMm: 70, heightMm: 20 }
  const WIDE_PROFILES: Map<string, ProfileDimensions> = new Map([['lam-70', WIDE_PROFILE]])
  // Tall enough rectangle to get several rows well clear of tMin/tMax edges.
  const contour: Point2D[] = [[0, 0], [3000, 0], [3000, 2000], [0, 2000]]
  const spec = baseSpec({ contour, lamellaGapMm: 20, lamellaProfileId: 'lam-70' })
  const pieces = computeLamellas(spec, WIDE_PROFILES)

  it('adjacent lamella centre lines are exactly 90 mm apart (70 width + 20 gap)', () => {
    const ys = [...new Set(pieces.map(p => Math.round(p.position[2] * 100) / 100))].sort((a, b) => a - b)
    expect(ys.length).toBeGreaterThan(2)
    for (let i = 1; i < ys.length; i++) {
      near(ys[i] - ys[i - 1], 90, 0.01)
    }
  })

  it('first row starts flush with the contour edge: centre = tMin + width/2 = 35 mm, NOT gap/2 = 10 mm', () => {
    const ys = pieces.map(p => p.position[2]).sort((a, b) => a - b)
    near(ys[0], 35, 0.01)
  })

  it('no piece protrudes past the contour along the scan axis (near edge >= tMin)', () => {
    const halfWidth = WIDE_PROFILE.widthMm / 2
    pieces.forEach(p => {
      expect(p.position[2] - halfWidth).toBeGreaterThanOrEqual(0 - 0.01)
    })
  })
})

// ── 9b. lamellaOnEdge — visible width swaps to profile.heightMm ─────────────

describe('lamellaOnEdge — a CORE compute parameter, not a render flag', () => {
  /*
   *  Prompt's worked example: f4020 (widthMm=40 flat-horizontal,
   *  heightMm=20 flat-vertical/thickness), gap=20mm.
   *    flat (onEdge=false): visible width = 40 → pitch = 60
   *    on edge (onEdge=true): visible width = 20 → pitch = 40
   *  Same geometry, different pitch ⇒ different piece count (this is the
   *  core recompute the prompt insists on — 3D must never fake this).
   */
  const F4020: ProfileDimensions = { widthMm: 40, heightMm: 20 }
  const F4020_PROFILES: Map<string, ProfileDimensions> = new Map([['lam-4020', F4020]])
  // 2400mm-tall rectangle: pitch 60 → 40 rows, pitch 40 → 60 rows — exactly
  // the 40-vs-60 ratio (2:3) called out in the prompt, with no edge-rounding
  // ambiguity (2400 divides evenly by both 60 and 40).
  const contour: Point2D[] = [[0, 0], [3000, 0], [3000, 2400], [0, 2400]]

  function countRows(onEdge: boolean): number {
    const spec = baseSpec({
      contour,
      lamellaGapMm: 20,
      lamellaProfileId: 'lam-4020',
      lamellaOnEdge: onEdge,
    })
    const pieces = computeLamellas(spec, F4020_PROFILES)
    return new Set(pieces.map(p => Math.round(p.position[2] * 100) / 100)).size
  }

  it('flat (default): pitch = widthMm + gap = 60mm', () => {
    const spec = baseSpec({ contour, lamellaGapMm: 20, lamellaProfileId: 'lam-4020' })
    const pieces = computeLamellas(spec, F4020_PROFILES)
    const ys = [...new Set(pieces.map(p => Math.round(p.position[2] * 100) / 100))].sort((a, b) => a - b)
    for (let i = 1; i < ys.length; i++) near(ys[i] - ys[i - 1], 60, 0.01)
  })

  it('on edge: pitch = heightMm + gap = 40mm', () => {
    const spec = baseSpec({
      contour, lamellaGapMm: 20, lamellaProfileId: 'lam-4020', lamellaOnEdge: true,
    })
    const pieces = computeLamellas(spec, F4020_PROFILES)
    const ys = [...new Set(pieces.map(p => Math.round(p.position[2] * 100) / 100))].sort((a, b) => a - b)
    for (let i = 1; i < ys.length; i++) near(ys[i] - ys[i - 1], 40, 0.01)
  })

  it('switching onEdge false→true changes the piece count in the 60:40 pitch ratio (more, thinner rows)', () => {
    const flatRows = countRows(false)
    const onEdgeRows = countRows(true)
    expect(onEdgeRows).toBeGreaterThan(flatRows)
    // pitch ratio 60:40 = 3:2 ⇒ row-count ratio ≈ 2:3 (inverse)
    near(onEdgeRows / flatRows, 3 / 2, 0.05)
  })

  it('onEdge folds +90° into the bevel (cutBevelDeg), additive with lamellaAngleDeg', () => {
    const flatSpec = baseSpec({
      contour, lamellaGapMm: 20, lamellaProfileId: 'lam-4020', lamellaAngleDeg: 15,
    })
    const onEdgeSpec = baseSpec({
      contour, lamellaGapMm: 20, lamellaProfileId: 'lam-4020', lamellaAngleDeg: 15, lamellaOnEdge: true,
    })
    const flatPieces = computeLamellas(flatSpec, F4020_PROFILES)
    const onEdgePieces = computeLamellas(onEdgeSpec, F4020_PROFILES)
    flatPieces.forEach(p => near(p.cutBevelStartDeg, 15, 0.01))
    onEdgePieces.forEach(p => near(p.cutBevelStartDeg, 105, 0.01)) // 15 + 90
  })

  it('back-compat: lamellaOnEdge omitted behaves exactly like lamellaOnEdge=false', () => {
    const omitted = baseSpec({ contour, lamellaGapMm: 20, lamellaProfileId: 'lam-4020' })
    const explicit = baseSpec({
      contour, lamellaGapMm: 20, lamellaProfileId: 'lam-4020', lamellaOnEdge: false,
    })
    const a = computeLamellas(omitted, F4020_PROFILES)
    const b = computeLamellas(explicit, F4020_PROFILES)
    expect(a.length).toBe(b.length)
    a.forEach((p, i) => near(p.position[2], b[i].position[2], 0.001))
  })
})

// ── 9c. Mixed lamella pattern — variable pitch, multiple profiles ───────────

describe('lamellaPattern — mixed widths, variable pitch (one code path, not a branch)', () => {
  /*
   *  Prompt's own worked example: cycling 70/40/20mm profiles (all
   *  heightMm=20, so lamellaOnEdge collapses the pattern to a UNIFORM
   *  visible width — used as a cross-check below).
   *
   *    spacing(i→i+1) = visibleWidth(i)/2 + gap + visibleWidth(i+1)/2
   *
   *  gap=20: 70→40 = 35+20+20 = 75, 40→20 = 20+20+10 = 50, 20→70 = 10+20+35 = 65
   *  gap=10: 70→40 = 35+10+20 = 65, 40→20 = 20+10+10 = 40, 20→70 = 10+10+35 = 55
   */
  const P70: ProfileDimensions = { widthMm: 70, heightMm: 20 }
  const P40: ProfileDimensions = { widthMm: 40, heightMm: 20 }
  const P20: ProfileDimensions = { widthMm: 20, heightMm: 20 }
  const MIX_PROFILES: Map<string, ProfileDimensions> = new Map([
    ['p70', P70], ['p40', P40], ['p20', P20],
  ])
  // Tall enough (1000mm) to get well past one full 3-row cycle.
  const contour: Point2D[] = [[0, 0], [3000, 0], [3000, 1000], [0, 1000]]

  function rowCenters(gapMm: number, onEdge = false): number[] {
    const spec = baseSpec({
      contour,
      lamellaGapMm: gapMm,
      lamellaProfileId: 'p70', // required fallback field; ignored — lamellaPattern wins
      lamellaPattern: ['p70', 'p40', 'p20'],
      lamellaOnEdge: onEdge,
    })
    const pieces = computeLamellas(spec, MIX_PROFILES)
    return [...new Set(pieces.map(p => Math.round(p.position[2] * 100) / 100))].sort((a, b) => a - b)
  }

  it('pattern of length 1 is equivalent to the plain single-profile case (regression, not a separate branch)', () => {
    const singleSpec = baseSpec({ contour, lamellaGapMm: 20, lamellaProfileId: 'p70' })
    const patternSpec = baseSpec({ contour, lamellaGapMm: 20, lamellaProfileId: 'p70', lamellaPattern: ['p70'] })
    const a = computeLamellas(singleSpec, MIX_PROFILES)
    const b = computeLamellas(patternSpec, MIX_PROFILES)
    expect(a.length).toBe(b.length)
    a.forEach((p, i) => near(p.position[2], b[i].position[2], 0.001))
  })

  it('gap=20mm: consecutive centre spacings cycle 75, 50, 65, 75, 50, 65…', () => {
    const centers = rowCenters(20)
    expect(centers.length).toBeGreaterThanOrEqual(7)
    const expected = [75, 50, 65]
    for (let i = 1; i < centers.length; i++) {
      near(centers[i] - centers[i - 1], expected[(i - 1) % 3], 0.01)
    }
  })

  it('gap=10mm: consecutive centre spacings cycle 65, 40, 55, 65, 40, 55…', () => {
    const centers = rowCenters(10)
    expect(centers.length).toBeGreaterThanOrEqual(7)
    const expected = [65, 40, 55]
    for (let i = 1; i < centers.length; i++) {
      near(centers[i] - centers[i - 1], expected[(i - 1) % 3], 0.01)
    }
  })

  it('first row centre = visibleWidth(pattern[0])/2 = 35mm (70mm profile leads the cycle)', () => {
    near(rowCenters(20)[0], 35, 0.01)
  })

  it('each profile in the pattern yields its own CutPiece group (profileId) — separate cut-list/stats groups', () => {
    const spec = baseSpec({
      contour, lamellaGapMm: 20, lamellaProfileId: 'p70', lamellaPattern: ['p70', 'p40', 'p20'],
    })
    const pieces = computeLamellas(spec, MIX_PROFILES)
    const byProfile = new Map<string, number>()
    pieces.forEach(p => byProfile.set(p.profileId, (byProfile.get(p.profileId) ?? 0) + 1))
    expect(byProfile.size).toBe(3)
    for (const id of ['p70', 'p40', 'p20']) expect(byProfile.get(id) ?? 0).toBeGreaterThan(0)
    // A perfectly cyclic pattern over a fixed span can only be off by one row.
    const counts = [...byProfile.values()]
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
  })

  it('lamellaOnEdge applies uniformly to every profile in the pattern (here all heightMm=20 → constant 40mm pitch)', () => {
    const centers = rowCenters(20, true)
    expect(centers.length).toBeGreaterThan(2)
    for (let i = 1; i < centers.length; i++) near(centers[i] - centers[i - 1], 40, 0.01)
  })
})

// ── 9d. Mixed pattern + purlins — thinnest profile's maxLamellaSpanMm governs ─

describe('mixed pattern + computePurlins — patternMaxLamellaSpanMm uses the SMALLEST span in the pattern', () => {
  const WIDE: ProfileDimensions = { widthMm: 70, heightMm: 20, maxLamellaSpanMm: 3000 }
  const THIN: ProfileDimensions = { widthMm: 20, heightMm: 20, maxLamellaSpanMm: 1000 }
  const PURLIN: ProfileDimensions = { widthMm: 60, heightMm: 100, interruptsLamella: true }
  const PROFILES: Map<string, ProfileDimensions> = new Map([
    ['wide', WIDE], ['thin', THIN], ['purlin-1', PURLIN],
  ])
  // Span 4000mm along dir (+X): with only WIDE (3000mm span) → 2 spans → 1 purlin.
  // With the mix (thin governs at 1000mm span) → 4 spans → 3 purlins.
  const contour: Point2D[] = [[0, 0], [4000, 0], [4000, 2000], [0, 2000]]

  it('single wide profile alone (no thin in the pattern): 1 purlin (4000/3000 → 2 spans)', () => {
    const spec = baseSpec({ contour, lamellaGapMm: 20, lamellaProfileId: 'wide', purlinProfileId: 'purlin-1' })
    const purlins = computePurlins(spec, PROFILES)
    expect(purlins).toHaveLength(1)
  })

  it('mixed pattern [wide, thin]: purlin count follows the THIN profile\'s smaller span (4000/1000 → 4 spans → 3 purlins)', () => {
    const spec = baseSpec({
      contour, lamellaGapMm: 20, lamellaProfileId: 'wide',
      lamellaPattern: ['wide', 'thin'], purlinProfileId: 'purlin-1',
    })
    const purlins = computePurlins(spec, PROFILES)
    expect(purlins).toHaveLength(3)
  })

  it('computeLamellas segments at the SAME crossings computePurlins used for the mixed pattern', () => {
    const spec = baseSpec({
      contour, lamellaGapMm: 20, lamellaProfileId: 'wide',
      lamellaPattern: ['wide', 'thin'], purlinProfileId: 'purlin-1',
    })
    const purlinXs = computePurlins(spec, PROFILES).map(p => Math.round(p.position[0])).sort((a, b) => a - b)
    expect(purlinXs).toEqual([1000, 2000, 3000])

    const pieces = computeLamellas(spec, PROFILES)
    const rows = new Map<number, typeof pieces>()
    pieces.forEach(p => {
      const key = Math.round(p.position[2] * 100) / 100
      rows.set(key, [...(rows.get(key) ?? []), p])
    })
    for (const rowPieces of rows.values()) {
      expect(rowPieces).toHaveLength(4) // 4 spans between/around the 3 purlins
      rowPieces.forEach(p => near(p.lengthAxisMm, 1000, 0.5))
    }
  })
})

// ── 10. Purlins + interruptsLamella segmentation ─────────────────────────────

describe('purlins — placement and lamella segmentation', () => {
  const LAMELLA: ProfileDimensions = { widthMm: 70, heightMm: 20, maxLamellaSpanMm: 1500 }
  const PURLIN_INTERRUPTING: ProfileDimensions = { widthMm: 60, heightMm: 100, interruptsLamella: true }
  const PURLIN_NON_INTERRUPTING: ProfileDimensions = { widthMm: 60, heightMm: 100, interruptsLamella: false }

  // Simple 6000×3000 rectangle, lamellas along +X → span along dir = 6000mm.
  // maxLamellaSpanMm=1500 → nSpans=ceil(6000/1500)=4 → 3 purlins at 1500/3000/4500,
  // 4 lamella segments per row (matches the prompt's own worked example).
  const contour: Point2D[] = [[0, 0], [6000, 0], [6000, 3000], [0, 3000]]

  function makeProfiles(purlin: ProfileDimensions): Map<string, ProfileDimensions> {
    return new Map([['lam-70', LAMELLA], ['purlin-1', purlin]])
  }

  it('interruptsLamella=true: 6000mm span / 1500mm max span → 4 segments per scan line, outer ends angled, inner ends straight', () => {
    const spec = baseSpec({
      contour,
      lamellaGapMm: 30,
      lamellaProfileId: 'lam-70',
      purlinProfileId: 'purlin-1',
    })
    const pieces = computeLamellas(spec, makeProfiles(PURLIN_INTERRUPTING))

    // Group by row (position[2], the scan-axis coordinate) — 4 segments per row.
    const rows = new Map<number, typeof pieces>()
    pieces.forEach(p => {
      const key = Math.round(p.position[2] * 100) / 100
      rows.set(key, [...(rows.get(key) ?? []), p])
    })
    expect(rows.size).toBeGreaterThan(0)

    for (const rowPieces of rows.values()) {
      expect(rowPieces).toHaveLength(4)
      const sorted = [...rowPieces].sort((a, b) => a.position[0] - b.position[0])
      sorted.forEach(p => near(p.lengthAxisMm, 1500, 0.5))

      // Outer ends (edge 3 = left, edge 1 = right of this axis-aligned rect) are straight too
      // (rectangle edges are ⊥ to the lamella direction) — the real signal here is that
      // INNER joints are ALWAYS straight regardless of contour shape.
      near(sorted[0].cutMiterEndDeg, 0, 0.01)      // inner joint after segment 0
      expect(sorted[0].cutHandEnd).toBe('straight')
      near(sorted[1].cutMiterStartDeg, 0, 0.01)     // inner joint before segment 1 (same cut)
      near(sorted[1].cutMiterEndDeg, 0, 0.01)       // inner joint after segment 1
      near(sorted[2].cutMiterStartDeg, 0, 0.01)
      near(sorted[2].cutMiterEndDeg, 0, 0.01)
      near(sorted[3].cutMiterStartDeg, 0, 0.01)     // inner joint before segment 3
    }
  })

  it('interruptsLamella=false: same geometry stays ONE continuous piece per row (pre-existing behaviour)', () => {
    const spec = baseSpec({
      contour,
      lamellaGapMm: 30,
      lamellaProfileId: 'lam-70',
      purlinProfileId: 'purlin-1',
    })
    const pieces = computeLamellas(spec, makeProfiles(PURLIN_NON_INTERRUPTING))

    const rows = new Map<number, number>()
    pieces.forEach(p => {
      const key = Math.round(p.position[2] * 100) / 100
      rows.set(key, (rows.get(key) ?? 0) + 1)
    })
    for (const count of rows.values()) expect(count).toBe(1)
    pieces.forEach(p => near(p.lengthAxisMm, 6000, 0.5))
  })

  it('no purlinProfileId → no segmentation (back-compat, pre-existing fixtures unaffected)', () => {
    const spec = baseSpec({ contour, lamellaGapMm: 30, lamellaProfileId: 'lam-70' })
    const pieces = computeLamellas(spec, makeProfiles(PURLIN_INTERRUPTING))
    pieces.forEach(p => near(p.lengthAxisMm, 6000, 0.5))
  })

  it('computePurlins: 3 purlins per crossing (nSpans-1), each spanning the full 3000mm width', () => {
    const spec = baseSpec({
      contour,
      lamellaGapMm: 30,
      lamellaProfileId: 'lam-70',
      purlinProfileId: 'purlin-1',
    })
    const purlins = computePurlins(spec, makeProfiles(PURLIN_INTERRUPTING))
    expect(purlins).toHaveLength(3)
    purlins.forEach(p => {
      expect(p.role).toBe('purlin')
      near(p.lengthAxisMm, 3000, 0.5)
      near(p.cutMiterStartDeg, 0, 0.01)
      near(p.cutMiterEndDeg, 0, 0.01)
    })
  })

  it('computePurlins: purlin x-positions are 1500, 3000, 4500', () => {
    const spec = baseSpec({
      contour,
      lamellaGapMm: 30,
      lamellaProfileId: 'lam-70',
      purlinProfileId: 'purlin-1',
    })
    const purlins = computePurlins(spec, makeProfiles(PURLIN_INTERRUPTING))
    const xs = purlins.map(p => Math.round(p.position[0])).sort((a, b) => a - b)
    expect(xs).toEqual([1500, 3000, 4500])
  })

  it('computePurlins: no purlinProfileId → []', () => {
    const spec = baseSpec({ contour, lamellaGapMm: 30, lamellaProfileId: 'lam-70' })
    expect(computePurlins(spec, makeProfiles(PURLIN_INTERRUPTING))).toHaveLength(0)
  })

  it('computePurlins: no maxLamellaSpanMm on lamella profile → []', () => {
    const noSpanLamella: ProfileDimensions = { widthMm: 70, heightMm: 20 }
    const spec = baseSpec({
      contour,
      lamellaGapMm: 30,
      lamellaProfileId: 'lam-70',
      purlinProfileId: 'purlin-1',
    })
    const profiles = new Map([['lam-70', noSpanLamella], ['purlin-1', PURLIN_INTERRUPTING]])
    expect(computePurlins(spec, profiles)).toHaveLength(0)
  })

  it('computePurlins: span already within maxLamellaSpanMm → []', () => {
    const shortRect: Point2D[] = [[0, 0], [1000, 0], [1000, 3000], [0, 3000]]
    const spec = baseSpec({
      contour: shortRect,
      lamellaGapMm: 30,
      lamellaProfileId: 'lam-70',
      purlinProfileId: 'purlin-1',
    })
    expect(computePurlins(spec, makeProfiles(PURLIN_INTERRUPTING))).toHaveLength(0)
  })

  it('computePurlins on an L-shape: the crossing through the notch clips shorter than the unclipped one', () => {
    // L-shape: outer 6000×6000 with a 3000×3000 notch removed from the top-right
    // (x:3000..6000, y:3000..6000 absent). dir=+X (lamellaDirectionDeg=0) → purlin
    // crossings scan vertically at x=1500 (left leg, full 6000mm height — the notch
    // doesn't touch x<3000) and x=4500 (right leg, ONLY the y<3000 strip remains —
    // clipped to exactly 3000mm, half the unclipped length).
    const lShape: Point2D[] = [
      [0, 0], [6000, 0], [6000, 3000], [3000, 3000], [3000, 6000], [0, 6000],
    ]
    const spec = baseSpec({
      contour: lShape,
      lamellaGapMm: 30,
      lamellaProfileId: 'lam-70',
      purlinProfileId: 'purlin-1',
    })
    const purlins = computePurlins(spec, makeProfiles(PURLIN_INTERRUPTING))
    purlins.forEach(p => expect(p.lengthAxisMm).toBeLessThanOrEqual(6000 + 0.5))

    const unclipped = purlins.filter(p => Math.abs(p.position[0] - 1500) < 1)
    const clippedByNotch = purlins.filter(p => Math.abs(p.position[0] - 4500) < 1)
    expect(unclipped.length).toBeGreaterThan(0)
    expect(clippedByNotch.length).toBeGreaterThan(0)
    unclipped.forEach(p => near(p.lengthAxisMm, 6000, 0.5))
    clippedByNotch.forEach(p => near(p.lengthAxisMm, 3000, 0.5))
  })

  // ── Vertical seating rule (position[1] / world Y) ──────────────────────────
  //
  // Both beams and lamellas are built with zMode: 'based' in the geometry
  // builder (see geometryBuilder.ts) — position.y IS the bottom face, with NO
  // extra centering offset, for every non-post role. So a lamella's bottom is
  // already flush with heightMm (same as a beam's bottom) with no correction
  // needed on the lamella side. The purlin, however, must pick its OWN
  // baseline depending on interruptsLamella (see purlins.ts "VERTICAL SEATING
  // RULE"): flush with heightMm when it replaces the lamella at that
  // crossing, or resting on the lamella's own top face when it doesn't.
  it('lamella position.y sits exactly at heightMm — its bottom is already flush with the beam bottom (zMode "based", no centering)', () => {
    const spec = baseSpec({ contour, lamellaGapMm: 30, lamellaProfileId: 'lam-70', heightMm: 2600 })
    const pieces = computeLamellas(spec, makeProfiles(PURLIN_INTERRUPTING))
    expect(pieces.length).toBeGreaterThan(0)
    pieces.forEach(p => near(p.position[1], 2600, 1e-6))
  })

  it('interruptsLamella=true: purlin position.y === heightMm (same baseline as the lamella/beam bottom — it replaces the lamella there)', () => {
    const spec = baseSpec({
      contour, lamellaGapMm: 30, lamellaProfileId: 'lam-70', purlinProfileId: 'purlin-1', heightMm: 2600,
    })
    const purlins = computePurlins(spec, makeProfiles(PURLIN_INTERRUPTING))
    expect(purlins.length).toBeGreaterThan(0)
    purlins.forEach(p => near(p.position[1], 2600, 1e-6))
  })

  it('interruptsLamella=false: purlin position.y === heightMm + lamella.heightMm (rests on the lamella top, does not touch it)', () => {
    const spec = baseSpec({
      contour, lamellaGapMm: 30, lamellaProfileId: 'lam-70', purlinProfileId: 'purlin-1', heightMm: 2600,
    })
    const purlins = computePurlins(spec, makeProfiles(PURLIN_NON_INTERRUPTING))
    expect(purlins.length).toBeGreaterThan(0)
    // LAMELLA.heightMm = 20 → purlin base at 2620, matching the worked example
    // (beam 2600..2700, lamella 2600..2620, purlin 2620..2680, both purlin
    // variants staying within the beam's own 100mm height envelope).
    purlins.forEach(p => near(p.position[1], 2620, 1e-6))
  })

  // ── VISTUR ASSEMBLY CLEARANCE (spec.visturTolerances) ──────────────────────
  // See prompt "рама-вистур": undefined ⇒ no change (all fixtures above);
  // set ⇒ retract only the two ends that meet the frame's OWN outer beam.

  it('undefined visturTolerances (default): lengthAxisMm is the raw span, exactly as every other fixture in this file expects', () => {
    const spec = baseSpec({ contour, lamellaGapMm: 30, lamellaProfileId: 'lam-70' })
    const pieces = computeLamellas(spec, makeProfiles(PURLIN_NON_INTERRUPTING))
    pieces.forEach((p) => near(p.lengthAxisMm, 6000, 0.5))
  })

  it('single continuous row (no purlin interruption): loses the FULL lamellaLengthReductionMm — both its ends are real contour cuts', () => {
    const spec = baseSpec({
      contour, lamellaGapMm: 30, lamellaProfileId: 'lam-70',
      visturTolerances: { beamSegmentReductionMm: 15, lamellaLengthReductionMm: 30 },
    })
    const pieces = computeLamellas(spec, makeProfiles(PURLIN_NON_INTERRUPTING))
    expect(pieces.length).toBeGreaterThan(0)
    pieces.forEach((p) => near(p.lengthAxisMm, 6000 - 30, 0.5))
  })

  it('4-segment interrupted row: only the 2 OUTER segments shrink (by reductionMm/2 each), inner segments stay exactly at maxLamellaSpanMm', () => {
    const spec = baseSpec({
      contour, lamellaGapMm: 30, lamellaProfileId: 'lam-70', purlinProfileId: 'purlin-1',
      visturTolerances: { beamSegmentReductionMm: 15, lamellaLengthReductionMm: 30 },
    })
    const pieces = computeLamellas(spec, makeProfiles(PURLIN_INTERRUPTING))

    const rows = new Map<number, typeof pieces>()
    pieces.forEach((p) => {
      const key = Math.round(p.position[2])
      rows.set(key, [...(rows.get(key) ?? []), p])
    })

    for (const rowPieces of rows.values()) {
      const sorted = [...rowPieces].sort((a, b) => a.position[0] - b.position[0])
      expect(sorted).toHaveLength(4)
      near(sorted[0].lengthAxisMm, 1500 - 15, 0.5) // outer segment: 1 real end retracted
      near(sorted[1].lengthAxisMm, 1500, 0.5)       // inner segment: untouched
      near(sorted[2].lengthAxisMm, 1500, 0.5)       // inner segment: untouched
      near(sorted[3].lengthAxisMm, 1500 - 15, 0.5) // outer segment: 1 real end retracted
      // Whole-row total material removed is always exactly reductionMm,
      // regardless of how many purlins cut the row into pieces.
      const total = sorted.reduce((sum, p) => sum + p.lengthAxisMm, 0)
      near(total, 6000 - 30, 1)
    }
  })

  it('retraction applies identically across a mixed lamella pattern and lamellaOnEdge — it is independent of visibleWidthMm', () => {
    const mixedProfiles = new Map<string, ProfileDimensions>([
      ['lam-70', LAMELLA],
      ['lam-40', { widthMm: 40, heightMm: 20, maxLamellaSpanMm: 1500 }],
      ['purlin-1', PURLIN_NON_INTERRUPTING],
    ])
    const spec = baseSpec({
      contour, lamellaGapMm: 30, lamellaPattern: ['lam-70', 'lam-40'], lamellaOnEdge: true,
      visturTolerances: { beamSegmentReductionMm: 15, lamellaLengthReductionMm: 30 },
    })
    const pieces = computeLamellas(spec, mixedProfiles)
    expect(pieces.length).toBeGreaterThan(0)
    // No purlin interruption here (PURLIN_NON_INTERRUPTING) → one piece per
    // row regardless of which profile/orientation that row uses.
    pieces.forEach((p) => near(p.lengthAxisMm, 6000 - 30, 0.5))
  })

  it('interruptsLamella=false with a mixed pattern: purlin rests on the TALLEST lamella profile in the mix, not the thinnest', () => {
    const tallLamella: ProfileDimensions = { widthMm: 40, heightMm: 45, maxLamellaSpanMm: 1500 }
    const profiles = new Map<string, ProfileDimensions>([
      ['lam-70', LAMELLA],       // heightMm 20
      ['lam-tall', tallLamella], // heightMm 45 — this one governs
      ['purlin-1', PURLIN_NON_INTERRUPTING],
    ])
    const spec = baseSpec({
      contour, lamellaGapMm: 30, lamellaPattern: ['lam-70', 'lam-tall'],
      purlinProfileId: 'purlin-1', heightMm: 2600,
    })
    const purlins = computePurlins(spec, profiles)
    expect(purlins.length).toBeGreaterThan(0)
    purlins.forEach(p => near(p.position[1], 2600 + 45, 1e-6))
  })
})
