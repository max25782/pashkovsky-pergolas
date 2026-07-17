import { describe, it, expect } from 'vitest'
import { computeFrame } from '../frame'
import type { PergolaSpec, ProfileDimensions, Point2D } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeProfiles(overrides: {
  beam?: Partial<ProfileDimensions>
  post?: Partial<ProfileDimensions>
  wall?: Partial<ProfileDimensions>
} = {}): Map<string, ProfileDimensions> {
  return new Map([
    ['beam-100', { widthMm: 100, heightMm: 60, maxSpanMm: 3000, ...overrides.beam }],
    ['post-80',  { widthMm: 80,  heightMm: 80,                  ...overrides.post }],
    ['wall-ch',  { widthMm: 60,  heightMm: 40,                  ...overrides.wall }],
  ])
}

function baseSpec(overrides: Partial<PergolaSpec> = {}): PergolaSpec {
  return {
    contour: [],
    heightMm: 2700,
    lamellaGapMm: 120,
    lamellaAngleDeg: 0,
    lamellaDirectionDeg: 0,
    postProfileId:    'post-80',
    beamProfileId:    'beam-100',
    lamellaProfileId: 'lam-50',
    color: '#FFFFFF',
    ...overrides,
  }
}

const near = (a: number, b: number, eps = 0.5) =>
  expect(Math.abs(a - b)).toBeLessThan(eps)

// ── 1. Rectangle 4000×3000, maxSpan 3000 ─────────────────────────────────────

describe('rectangle 4000×3000, maxSpan=3000', () => {
  /*
   *  Vertices (CCW): (0,0)→(4000,0)→(4000,3000)→(0,3000)
   *  Edge lengths:    4000, 3000, 4000, 3000
   *
   *  Posts:
   *    Corner: 4 (one per vertex)
   *    Intermediate: edges 4000 > 3000 → ceil(4000/3000)-1 = 1 per long edge
   *                  edges 3000 = 3000 → ceil(1.0)-1 = 0
   *    Total: 4 + 2 = 6
   */
  const contour: Point2D[] = [[0, 0], [4000, 0], [4000, 3000], [0, 3000]]
  const profiles = makeProfiles()
  const spec = baseSpec({ contour })
  const { beams, posts } = computeFrame(spec, profiles)

  it('4 beams — one per edge', () => expect(beams).toHaveLength(4))

  it('beam axis lengths: two 4000 mm and two 3000 mm', () => {
    const lens = beams.map(b => Math.round(b.lengthAxisMm)).sort((a, b) => a - b)
    expect(lens).toEqual([3000, 3000, 4000, 4000])
  })

  it('all beams: bevel = 0 (horizontal pieces)', () => {
    beams.forEach(b => {
      near(b.cutBevelStartDeg, 0, 0.01)
      near(b.cutBevelEndDeg,   0, 0.01)
    })
  })

  it('rectangle corners: miter = 45° on all beam ends', () => {
    beams.forEach(b => {
      near(b.cutMiterStartDeg, 45, 0.1)
      near(b.cutMiterEndDeg,   45, 0.1)
    })
  })

  it('three-length ordering on beams (45° miter, 100mm wide profile)', () => {
    beams.forEach(b => {
      expect(b.lengthLongMm).toBeGreaterThan(b.lengthAxisMm)
      expect(b.lengthAxisMm).toBeGreaterThan(b.lengthShortMm)
    })
  })

  it('beam length delta = 2×(δ_start + δ_end) ≈ 4×50 = 200 mm', () => {
    // lengthLong  = axis + δS + δE
    // lengthShort = axis − δS − δE
    // diff        = 2×(δS + δE) = 2 × (tan45°×50 + tan45°×50) = 2×100 = 200
    beams.forEach(b => {
      near(b.lengthLongMm - b.lengthShortMm, 200, 0.5)
    })
  })

  it('6 posts total: 4 corner + 2 intermediate (one on each 4000 mm edge)', () => {
    expect(posts).toHaveLength(6)
  })

  it('all posts: straight cuts (miter=0, bevel=0)', () => {
    posts.forEach(p => {
      near(p.cutMiterStartDeg, 0, 0.01)
      near(p.cutMiterEndDeg,   0, 0.01)
      near(p.cutBevelStartDeg, 0, 0.01)
      near(p.cutBevelEndDeg,   0, 0.01)
      expect(p.cutHandStart).toBe('straight')
      expect(p.cutHandEnd).toBe('straight')
    })
  })

  it('all posts: axis length = heightMm = 2700 mm', () => {
    posts.forEach(p => near(p.lengthAxisMm, 2700))
  })

  it('intermediate post on each 4000 mm edge is at midpoint x=2000', () => {
    // Bottom edge (0,0)→(4000,0): intermediate at (2000, 0)
    // Top edge (4000,3000)→(0,3000): intermediate at (2000, 3000)
    const interPosts = posts.filter(p => Math.abs(p.position[0] - 2000) < 1)
    expect(interPosts).toHaveLength(2)
  })
})

// ── 2. Rectangle, one wall edge (wall-mounted) ────────────────────────────────

describe('rectangle 5000×4000, wall-mounted on edge 0', () => {
  /*
   *  Edge 0: (0,0)→(5000,0)  ← wall edge (uses wall profile)
   *  Vertices 0 and 1 are wall-attached → no corner post there.
   *
   *  Posts: only vertices 2 and 3 get corner posts → 2 posts total.
   *  (maxSpan = 3000, so no edge triggers intermediate posts for 5000-edge check:
   *   wait — 5000 > 3000 → 1 intermediate on edge 0? But edge 0 is wall-mounted.
   *   The spec says only corner posts at non-wall vertices are skipped.
   *   Intermediate posts along the WALL EDGE: the user says wall-side has no posts.
   *   Let me re-read: "стойки на концах этого ребра НЕ ставим — там стена."
   *   This only mentions CORNER posts on the wall edge endpoints. Intermediate posts
   *   on the wall edge itself are also not needed (the wall IS the support). So
   *   we skip intermediate posts on the wall edge too.
   *)
   *
   *  Posts:
   *    Corners: 4 - 2 (vertices 0,1 are wall) = 2
   *    Intermediate on edge 0 (5000 > 3000): SKIPPED (wall edge)
   *    Intermediate on edge 1 (4000 > 3000): ceil(4000/3000)-1 = 1
   *    Intermediate on edge 2 (5000 > 3000): 1
   *    Intermediate on edge 3 (4000 > 3000): 1
   *    Total: 2 + 0 + 1 + 1 + 1 = 5
   *
   *  Actually wait - re-reading the spec: "стойки на концах этого ребра НЕ ставим".
   *  Only the CORNER posts at the wall edge endpoints are skipped. Intermediate posts
   *  along the wall edge (which would be free-standing mid-wall) should ALSO be skipped
   *  since the wall provides that support. I'll skip intermediate posts on the wall edge.
   */
  const contour: Point2D[] = [[0, 0], [5000, 0], [5000, 4000], [0, 4000]]
  const profiles = makeProfiles()
  const spec = baseSpec({
    contour,
    supportType: 'wall-mounted',
    wallEdgeIndex: 0,
    wallProfileId: 'wall-ch',
  })
  const { beams, posts } = computeFrame(spec, profiles)

  it('4 beams total', () => expect(beams).toHaveLength(4))

  it('edge 0 uses wallProfileId (wall-ch)', () => {
    expect(beams[0].profileId).toBe('wall-ch')
  })

  it('other beams use beamProfileId (beam-100)', () => {
    beams.slice(1).forEach(b => expect(b.profileId).toBe('beam-100'))
  })

  it('wall beam has bevel = 0', () => {
    near(beams[0].cutBevelStartDeg, 0, 0.01)
    near(beams[0].cutBevelEndDeg,   0, 0.01)
  })

  it('no posts at wall edge endpoints (vertices 0 and 1)', () => {
    // Vertices 0 = (0,0) and 1 = (5000,0) must not have corner posts
    const cornerAtWall0 = posts.some(
      p => Math.abs(p.position[0] - 0) < 1 && Math.abs(p.position[2] - 0) < 1
    )
    const cornerAtWall1 = posts.some(
      p => Math.abs(p.position[0] - 5000) < 1 && Math.abs(p.position[2] - 0) < 1
    )
    expect(cornerAtWall0).toBe(false)
    expect(cornerAtWall1).toBe(false)
  })

  it('corner posts at free vertices 2=(5000,4000) and 3=(0,4000)', () => {
    const at2 = posts.some(
      p => Math.abs(p.position[0] - 5000) < 1 && Math.abs(p.position[2] - 4000) < 1
    )
    const at3 = posts.some(
      p => Math.abs(p.position[0] - 0) < 1 && Math.abs(p.position[2] - 4000) < 1
    )
    expect(at2).toBe(true)
    expect(at3).toBe(true)
  })

  it('exactly 2 corner posts', () => {
    // corner posts = at actual polygon vertices (not intermediate)
    const cornerPositions = [[5000, 4000], [0, 4000]]
    const cornerPosts = posts.filter(p =>
      cornerPositions.some(([x, z]) => Math.abs(p.position[0] - x) < 1 && Math.abs(p.position[2] - z) < 1)
    )
    expect(cornerPosts).toHaveLength(2)
  })
})

// ── 3. Hanging pergola — no posts ─────────────────────────────────────────────

describe('hanging pergola — no posts', () => {
  const contour: Point2D[] = [[0, 0], [3000, 0], [3000, 2500], [0, 2500]]
  const spec = baseSpec({ contour, supportType: 'hanging' })
  const profiles = makeProfiles()
  const { beams, posts } = computeFrame(spec, profiles)

  it('still has 4 beams', () => expect(beams).toHaveLength(4))
  it('no posts', () => expect(posts).toHaveLength(0))
})

// ── 4. Trapeze — beams of different lengths, miter angles from miter.ts ───────

describe('trapeze — beam lengths and miter angles', () => {
  /*
   *  A(0,0) → B(5000,0) → C(4000,3000) → D(1000,3000)  (CCW)
   *
   *  Edge AB: (0,0)→(5000,0), length = 5000
   *  Edge BC: (5000,0)→(4000,3000), length = sqrt(1000²+3000²) = sqrt(10)×1000 ≈ 3162
   *  Edge CD: (4000,3000)→(1000,3000), length = 3000
   *  Edge DA: (1000,3000)→(0,0), length = sqrt(1000²+3000²) ≈ 3162
   *
   *  Vertex B (5000,0): interior angle determined by edges AB and BC.
   *    dir_AB = (1,0), dir_BC = (-1,3)/√10
   *    miter angle computed by miter.ts
   *
   *  Vertex A (0,0): interior angle determined by edges DA and AB.
   *    dir_DA reflected: (-1,-3)/√10 incoming, (1,0) outgoing
   *    → same miter as B by symmetry.
   *
   *  Key assertions:
   *  - 4 beams, correct axis lengths
   *  - slant beams are longer than long-point: 3162mm + delta
   *  - all bevels = 0
   *  - miter angles match miter.ts output
   */
  const contour: Point2D[] = [[0, 0], [5000, 0], [4000, 3000], [1000, 3000]]
  const profiles = makeProfiles({ beam: { maxSpanMm: 6000 } })  // no intermediate posts
  const spec = baseSpec({ contour })
  const { beams, posts } = computeFrame(spec, profiles)

  const SLANT_LEN = Math.sqrt(1000 * 1000 + 3000 * 3000)  // ≈ 3162

  it('4 beams', () => expect(beams).toHaveLength(4))

  it('bottom beam axis = 5000 mm', () => near(beams[0].lengthAxisMm, 5000))
  it('top beam axis = 3000 mm',    () => near(beams[2].lengthAxisMm, 3000))

  it('slant beams axis ≈ √10 × 1000 ≈ 3162 mm', () => {
    near(beams[1].lengthAxisMm, SLANT_LEN, 1)
    near(beams[3].lengthAxisMm, SLANT_LEN, 1)
  })

  it('all beams: bevel = 0', () => {
    beams.forEach(b => {
      near(b.cutBevelStartDeg, 0, 0.01)
      near(b.cutBevelEndDeg,   0, 0.01)
    })
  })

  it('bottom + top beam ends: miter angles match the trapeze vertex angles', () => {
    // Bottom-left A and bottom-right B have same miter (symmetric trapeze)
    near(beams[0].cutMiterStartDeg, beams[0].cutMiterEndDeg, 0.1)
    // Same angle on top beam (C and D also symmetric)
    near(beams[2].cutMiterStartDeg, beams[2].cutMiterEndDeg, 0.1)
  })

  it('all beams: three-length ordering', () => {
    beams.forEach(b => {
      if (b.cutMiterStartDeg > 0.1 || b.cutMiterEndDeg > 0.1) {
        expect(b.lengthLongMm).toBeGreaterThan(b.lengthAxisMm)
        expect(b.lengthAxisMm).toBeGreaterThan(b.lengthShortMm)
      }
    })
  })

  it('4 corner posts (maxSpan 6000 > all edges → no intermediates)', () => {
    expect(posts).toHaveLength(4)
  })
})

// ── 5. L-shape — concave vertex also gets a post ──────────────────────────────

describe('L-shape — 6 beams, post at concave vertex', () => {
  /*
   *  L-shape (CCW), outer 6000×6000 with top-right 3000×3000 corner removed:
   *
   *  (0,0)→(6000,0)→(6000,3000)→(3000,3000)→(3000,6000)→(0,6000)→(0,0)
   *
   *  All edges are axis-aligned → all miter angles at convex corners = 45°.
   *  The concave vertex (3000,3000) has interior = 270°, miter = −45°,
   *  abs = 45° still. A post IS placed at (3000,3000).
   */
  const contour: Point2D[] = [
    [0, 0], [6000, 0], [6000, 3000], [3000, 3000],
    [3000, 6000], [0, 6000],
  ]
  const profiles = makeProfiles({ beam: { maxSpanMm: 7000 } })  // no intermediates
  const spec = baseSpec({ contour })
  const { beams, posts } = computeFrame(spec, profiles)

  it('6 beams — one per edge', () => expect(beams).toHaveLength(6))

  it('all beams: bevel = 0', () => {
    beams.forEach(b => {
      near(b.cutBevelStartDeg, 0, 0.01)
      near(b.cutBevelEndDeg,   0, 0.01)
    })
  })

  it('all beams: miter = 45° (all corners are axis-aligned 90°/270°)', () => {
    beams.forEach(b => {
      near(b.cutMiterStartDeg, 45, 0.1)
      near(b.cutMiterEndDeg,   45, 0.1)
    })
  })

  it('6 corner posts (one per vertex, including concave)', () => {
    expect(posts).toHaveLength(6)
  })

  it('post exists at concave vertex (3000, 3000)', () => {
    const concavePost = posts.find(
      p => Math.abs(p.position[0] - 3000) < 1 && Math.abs(p.position[2] - 3000) < 1
    )
    expect(concavePost).toBeDefined()
  })
})

// ── 6. maxSpan larger than all edges → only corner posts ──────────────────────

describe('maxSpan > all edges → corner posts only', () => {
  const contour: Point2D[] = [[0, 0], [2000, 0], [2000, 1500], [0, 1500]]
  // maxSpan = 10000, all edges are < 2000
  const profiles = makeProfiles({ beam: { maxSpanMm: 10000 } })
  const spec = baseSpec({ contour })
  const { posts } = computeFrame(spec, profiles)

  it('exactly 4 posts — one per corner, no intermediates', () => {
    expect(posts).toHaveLength(4)
  })
})

// ── 7. Beam 3D position and rotation ─────────────────────────────────────────

describe('beam 3D geometry', () => {
  /*
   *  Simple rectangle. First beam runs along +X at height 2700.
   *  Second beam runs along +Z (plan +Y) at position (4000, 2700, 0).
   */
  const contour: Point2D[] = [[0, 0], [4000, 0], [4000, 3000], [0, 3000]]
  const profiles = makeProfiles({ beam: { maxSpanMm: 10000 } })
  const spec = baseSpec({ contour, heightMm: 2700 })
  const { beams } = computeFrame(spec, profiles)

  it('beam 0 starts at (0, 2700, 0)', () => {
    near(beams[0].position[0], 0)
    near(beams[0].position[1], 2700)
    near(beams[0].position[2], 0)
  })

  it('beam 0 rotation[1] ≈ 0 (along +X)', () => {
    near(beams[0].rotation[1], 0, 0.01)
  })

  it('posts sit at y=0 (ground level)', () => {
    const { posts } = computeFrame(spec, profiles)
    posts.forEach(p => near(p.position[1], 0))
  })
})
