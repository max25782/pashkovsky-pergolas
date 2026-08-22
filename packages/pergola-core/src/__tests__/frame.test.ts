import { describe, it, expect } from 'vitest'
import { computeFrame } from '../frame'
import { segmentBeamsForStock } from '../beamSegmentation'
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
    wallEdgeIndices: [0],
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

// ── 5b. Same L-shape, but the contour carries an editor-drawing artifact:
//        a duplicate vertex at the concave corner (e.g. two clicks landing on
//        the same point, or a numeric edge length committed as ~0mm — see
//        EdgeEditor.tsx/SizesPanel.tsx). Regression for contourSanitize.ts's
//        entry-point sanitisation in computeFrame: without it,
//        decomposeIntoRectangles bails out on the zero-length side and
//        computeFrame loses buildShapeGrid/wing-boundary awareness entirely,
//        which is exactly how a division line used to leak into a wing.
describe('L-shape with a duplicate vertex at the concave corner — computeFrame output unaffected', () => {
  const dirtyContour: Point2D[] = [
    [0, 0], [6000, 0], [6000, 3000], [3000, 3000], [3000, 3000],
    [3000, 6000], [0, 6000],
  ]
  const profiles = makeProfiles({ beam: { maxSpanMm: 7000 } })
  const spec = baseSpec({ contour: dirtyContour })
  const { beams, posts, isOrthogonal } = computeFrame(spec, profiles)

  it('is still recognised as orthogonal (grid-based path, not the degraded fallback)', () => {
    expect(isOrthogonal).toBe(true)
  })

  it('6 beams — one per edge, not 7 (the duplicate vertex does not become an extra edge)', () => {
    expect(beams).toHaveLength(6)
  })

  it('6 corner posts, including exactly one post at the concave vertex (3000, 3000) — not two', () => {
    expect(posts).toHaveLength(6)
    const atConcave = posts.filter(
      p => Math.abs(p.position[0] - 3000) < 1 && Math.abs(p.position[2] - 3000) < 1
    )
    expect(atConcave).toHaveLength(1)
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

// ── 8. wallEdgeIndices generalised to a SET — L-shape, two wall sides ────────

describe('L-shape, two wall edges — corner posts only at free vertices', () => {
  /*
   *  Same L-shape as test 5: (0,0)→(6000,0)→(6000,3000)→(3000,3000)→
   *  (3000,6000)→(0,6000), vertices 0..5.
   *
   *  Building corner: edges 4 ((3000,6000)→(0,6000)) and 5 ((0,6000)→(0,0))
   *  are both against the wall — a real L-shaped pergola built into a
   *  building corner, the case the single-wallEdgeIndex model could not
   *  express at all (see promt "две стороны у стены").
   *
   *  Rule (per-vertex): a vertex is skipped iff it is an endpoint of AT LEAST
   *  ONE wall edge. Endpoints of edges {4,5}: vertices {4, 5, 0}
   *  = (3000,6000), (0,6000), (0,0). Free vertices, KEEP their post:
   *  {1, 2, 3} = (6000,0), (6000,3000), (3000,3000) — includes the concave
   *  vertex 3, which sits at the transition between the wall run and the
   *  free run and must keep its post (nothing else holds up beam 2/3 there).
   */
  const contour: Point2D[] = [
    [0, 0], [6000, 0], [6000, 3000], [3000, 3000],
    [3000, 6000], [0, 6000],
  ]
  const profiles = makeProfiles({ beam: { maxSpanMm: 7000 }, wall: { maxSpanMm: 7000 } })
  const spec = baseSpec({
    contour,
    supportType: 'wall-mounted',
    wallEdgeIndices: [4, 5],
    wallProfileId: 'wall-ch',
  })
  const { beams, posts } = computeFrame(spec, profiles)

  it('6 beams total, edges 4 and 5 use the wall profile', () => {
    expect(beams).toHaveLength(6)
    expect(beams[4].profileId).toBe('wall-ch')
    expect(beams[5].profileId).toBe('wall-ch')
    expect(beams[0].profileId).toBe('beam-100')
  })

  it('exactly 3 corner posts — one per free vertex', () => {
    expect(posts).toHaveLength(3)
  })

  const freeVertices: Point2D[] = [[6000, 0], [6000, 3000], [3000, 3000]]
  const wallVertices: Point2D[] = [[3000, 6000], [0, 6000], [0, 0]]

  it('posts exist at all three free vertices (including the concave one)', () => {
    freeVertices.forEach(([x, z]) => {
      const found = posts.some(p => Math.abs(p.position[0] - x) < 1 && Math.abs(p.position[2] - z) < 1)
      expect(found).toBe(true)
    })
  })

  it('no post at any wall-edge endpoint, even where the OTHER side is free', () => {
    // (0,0) and (3000,6000) each have exactly one free neighbouring edge —
    // this is exactly the "corner between wall and free side" case the
    // per-vertex rule must still resolve to "no post" for, per spec.
    wallVertices.forEach(([x, z]) => {
      const found = posts.some(p => Math.abs(p.position[0] - x) < 1 && Math.abs(p.position[2] - z) < 1)
      expect(found).toBe(false)
    })
  })
})

// ── 9. Вистур: beam split per bay, retracted at every post ───────────────────
// See visturTolerances.ts "TWO AXES, TWO PARTS" — the −15mm (default
// beamSegmentReductionMm) axis cuts the PERIMETER BEAM SEGMENT welded
// between two adjacent posts, never the lamella and never a post itself.

describe('вистур: undefined visturTolerances — beams unsegmented, exactly the legacy behaviour', () => {
  const contour: Point2D[] = [[0, 0], [4000, 0], [4000, 3000], [0, 3000]]
  const profiles = makeProfiles()
  const spec = baseSpec({ contour })
  const { beams } = computeFrame(spec, profiles)

  it('still 4 beams (one per edge), even though the 4000mm edges each have an intermediate post', () => {
    expect(beams).toHaveLength(4)
    const lens = beams.map(b => Math.round(b.lengthAxisMm)).sort((a, b) => a - b)
    expect(lens).toEqual([3000, 3000, 4000, 4000])
  })
})

describe('вистур: single bay, no intermediate post — both ends retracted (проём 1300 → 1285 shape)', () => {
  // Small rectangle where NEITHER edge triggers an intermediate post
  // (maxSpan 3000 > every edge) — this is exactly the plain "one welded
  // segment between two posts" case from the prompt example.
  const contour: Point2D[] = [[0, 0], [1300, 0], [1300, 1300], [0, 1300]]
  const profiles = makeProfiles()
  const spec = baseSpec({ contour, visturTolerances: { beamSegmentReductionMm: 15, lamellaLengthReductionMm: 30 } })
  const { beams, posts } = computeFrame(spec, profiles)

  it('4 posts, 4 beams (still one segment per edge — no intermediate post here)', () => {
    expect(posts).toHaveLength(4)
    expect(beams).toHaveLength(4)
  })

  it('every beam loses the FULL 15mm (both its ends are real free-standing posts)', () => {
    beams.forEach(b => near(b.lengthAxisMm, 1300 - 15, 0.5))
  })

  it('retraction keeps the beam centered on the original post-to-post span', () => {
    // beam 0 runs from (0,0) to (1300,0): retracted 7.5mm off each end.
    near(beams[0].position[0], 7.5, 0.1)
    near(beams[0].position[2], 0, 0.1)
  })
})

describe('вистур: one intermediate post on a long edge — beam splits into 2 bays, BOTH retracted at the shared post', () => {
  // Long edge 4000mm with maxSpan 3000 → exactly 1 intermediate post at
  // its midpoint (2000). Under вистур that single edge becomes 2 welded
  // beam segments, and the shared (post) boundary is retracted on BOTH
  // sides — unlike the lamella/purlin case, every boundary here IS a post.
  const contour: Point2D[] = [[0, 0], [4000, 0], [4000, 3000], [0, 3000]]
  const profiles = makeProfiles()
  const spec = baseSpec({ contour, visturTolerances: { beamSegmentReductionMm: 15, lamellaLengthReductionMm: 30 } })
  const { beams, posts } = computeFrame(spec, profiles)

  it('6 posts total (unchanged from the non-вистур case — вистур never adds/removes posts)', () => {
    expect(posts).toHaveLength(6)
  })

  it('6 beam segments total: the two 4000mm edges split into 2 each, the two 3000mm edges stay 1 each', () => {
    expect(beams).toHaveLength(6)
  })

  it('each 2000mm bay on a split edge loses 15mm total (7.5 off each end, one shared post boundary)', () => {
    const shortSegments = beams.filter(b => Math.abs(b.lengthAxisMm - (2000 - 15)) < 0.5)
    expect(shortSegments).toHaveLength(4) // 2 bays × 2 long edges
  })

  it('the two untouched 3000mm edges each lose the full 15mm (both ends are free-standing corner posts)', () => {
    const fullEdgeSegments = beams.filter(b => Math.abs(b.lengthAxisMm - (3000 - 15)) < 0.5)
    expect(fullEdgeSegments).toHaveLength(2)
  })

  it('inner (post-crossing) ends of a split beam are straight cuts (miter=0), outer end keeps the real 45° corner', () => {
    // The two half-segments of a 4000mm edge: outer end keeps the real
    // corner miter (45° on this rectangle), inner (post-crossing) end is straight.
    const halfSegments = beams.filter(b => Math.abs(b.lengthAxisMm - (2000 - 15)) < 0.5)
    expect(halfSegments.length).toBeGreaterThan(0)
    halfSegments.forEach(b => {
      const hasStraightEnd = b.cutHandStart === 'straight' || b.cutHandEnd === 'straight'
      expect(hasStraightEnd).toBe(true)
      expect(Math.max(b.cutMiterStartDeg, b.cutMiterEndDeg)).toBeCloseTo(45, 0)
      expect(Math.min(b.cutMiterStartDeg, b.cutMiterEndDeg)).toBeCloseTo(0, 0)
    })
  })
})

describe('вистур + wall-mounted: the wall-edge outer end has no post → keeps full span there, no retraction', () => {
  const contour: Point2D[] = [[0, 0], [1300, 0], [1300, 1300], [0, 1300]]
  const profiles = makeProfiles()
  const spec = baseSpec({
    contour,
    supportType: 'wall-mounted',
    wallEdgeIndices: [3], // edge (0,1300)→(0,0): vertices 3 and 0 are wall vertices, no post
    wallProfileId: 'wall-ch',
    visturTolerances: { beamSegmentReductionMm: 15, lamellaLengthReductionMm: 30 },
  })
  const { beams, posts } = computeFrame(spec, profiles)

  it('only 2 corner posts (vertices 1 and 2 are free; 0 and 3 are wall vertices)', () => {
    expect(posts).toHaveLength(2)
  })

  it('the wall beam (edge 3) is NOT retracted at either end — no post exists there to weld a gap against', () => {
    const wallBeam = beams.find(b => b.profileId === 'wall-ch')
    expect(wallBeam).toBeDefined()
    near(wallBeam!.lengthAxisMm, 1300, 0.5)
  })

  it('a beam edge with a real post at BOTH ends still loses the full 15mm', () => {
    const freeBeam = beams.find(b => b.profileId === 'beam-100' && Math.abs(b.lengthAxisMm - (1300 - 15)) < 0.5)
    expect(freeBeam).toBeDefined()
  })
})

describe('вистур + hanging: no posts at all → вистур segmentation is skipped, beams stay one piece per edge', () => {
  const contour: Point2D[] = [[0, 0], [3000, 0], [3000, 2500], [0, 2500]]
  const spec = baseSpec({ contour, supportType: 'hanging', visturTolerances: { beamSegmentReductionMm: 15, lamellaLengthReductionMm: 30 } })
  const profiles = makeProfiles()
  const { beams, posts } = computeFrame(spec, profiles)

  it('still 4 beams, no posts, and NO retraction (nothing to weld a gap against)', () => {
    expect(beams).toHaveLength(4)
    expect(posts).toHaveLength(0)
    near(beams[0].lengthAxisMm, 3000, 0.5)
  })
})

// ── 10. Вистур on an L-shape: bays split at the SAME wing boundary as the
// posts, not at the old whole-raw-edge maxSpanMm midpoint ───────────────────
// See prompt "вистур-режим на той же L-форме: балка режется на пролёты по
// тем же границам крыльев, что и стойки, не по старой длине ребра. Это тот
// тест, который поймает, если бы два расчёта разъехались." Exact numbers
// from the originally-reported sliver: reflex vertex at x=3677 on a 7922mm
// edge, maxSpanMm=4500 (both wings, 3677 and 4245, individually fit under
// maxSpanMm — old code instead ran maxSpanMm against the whole 7922mm raw
// edge and split at its naive midpoint, 3961).

describe('вистур + L-shape: bottom beam bays match the shape wing boundary (3677 | 4245), not the old raw-edge midpoint (3961)', () => {
  const contour: Point2D[] = [
    [0, 0], [7922, 0], [7922, 3000], [3677, 3000], [3677, 6000], [0, 6000],
  ]
  const profiles = makeProfiles({ beam: { maxSpanMm: 4500 } })
  const spec = baseSpec({ contour, visturTolerances: { beamSegmentReductionMm: 15, lamellaLengthReductionMm: 30 } })
  const { beams, posts } = computeFrame(spec, profiles)
  const bottomBeams = beams
    .filter(b => Math.abs(b.position[2]) < 1 && b.profileId === 'beam-100')
    .sort((a, b) => a.position[0] - b.position[0])

  it('exactly 2 bays for the bottom edge (one real wall, no maxSpanMm midpoint split)', () => {
    expect(bottomBeams).toHaveLength(2)
  })

  it('bay lengths are the wing-boundary raw spans (3677, 4245) minus the 15mm вистур retraction — NOT two ~3946mm halves of the raw 7922mm edge', () => {
    const lens = bottomBeams.map(b => b.lengthAxisMm)
    near(lens[0], 3677 - 15, 0.5)
    near(lens[1], 4245 - 15, 0.5)
  })

  it('no post (and so no bay boundary) anywhere near the old naive whole-edge midpoint, 3961', () => {
    expect(posts.some(p => Math.abs(p.position[0] - 3961) < 1 && Math.abs(p.position[2]) < 1)).toBe(false)
  })

  it('the shared bay boundary sits exactly at the reflex vertex, 3677 (both bays retract 7.5mm into it)', () => {
    near(bottomBeams[0].position[0] + bottomBeams[0].lengthAxisMm, 3677 - 7.5, 0.5)
    near(bottomBeams[1].position[0], 3677 + 7.5, 0.5)
  })
})

// ── 11. Shape-wide post grid — see prompt "единая сетка стоек через всю
// форму": maxSpanMm posts now come from ONE grid shared by every edge on an
// axis, not a per-edge computation. Two symptoms this must kill: (a) a
// short wing must never get a post past its own end just because a distant
// wall shares its coordinate, (b) two parallel edges (top/bottom) must end
// up with IDENTICAL final X coordinates once wing-boundary posts (added
// downstream by segmentBeamsForStock) are folded in too. ─────────────────────

describe('shape-wide post grid: a short wing never gets a post beyond its own end', () => {
  // Classic single-reflex L: the RIGHT edge only runs y∈[0,3000], while the
  // LEFT edge runs the full y∈[0,6000]. The global yGrid (built from the
  // union of every vertical edge) contains an intermediate at y=4500 that is
  // real for the LEFT edge but lies past the RIGHT edge's own end.
  const contour: Point2D[] = [
    [0, 0], [8000, 0], [8000, 3000], [3000, 3000], [3000, 6000], [0, 6000],
  ]
  const profiles = makeProfiles({ beam: { maxSpanMm: 2000 } })
  const spec = baseSpec({ contour })
  const { posts } = computeFrame(spec, profiles)

  const rightEdgePosts = posts.filter(p => Math.abs(p.position[0] - 8000) < 1)
  const leftEdgePosts = posts.filter(p => Math.abs(p.position[0] - 0) < 1)

  it('the short right edge (y up to 3000) gets an intra post at y=1500, but NOT at y=4500', () => {
    expect(rightEdgePosts.some(p => Math.abs(p.position[2] - 1500) < 1)).toBe(true)
    expect(rightEdgePosts.some(p => Math.abs(p.position[2] - 4500) < 1)).toBe(false)
    // and definitely nothing past its own far end (y=3000)
    expect(rightEdgePosts.every(p => p.position[2] <= 3000 + 1)).toBe(true)
  })

  it('the long left edge (y up to 6000), which DOES reach that far, gets posts at both y=1500 and y=4500', () => {
    expect(leftEdgePosts.some(p => Math.abs(p.position[2] - 1500) < 1)).toBe(true)
    expect(leftEdgePosts.some(p => Math.abs(p.position[2] - 4500) < 1)).toBe(true)
  })
})

describe('shape-wide post grid: top and bottom posts land on IDENTICAL X once wing-boundary posts are folded in — no more rassinhron', () => {
  // The C-shape from the diagnosis: two reflex vertices at DIFFERENT x
  // (3000 and 6000) mean the bottom edge (z=0) and top edge (z=6000) see
  // DIFFERENT own wing-boundary sets (bottom={3000}, top={3000,6000}) — the
  // exact case that used to desync them (1500/5000/7000 vs 7500/4500/1500).
  const contour: Point2D[] = [
    [0, 0], [9000, 0], [9000, 2000], [3000, 2000], [3000, 3000],
    [6000, 3000], [6000, 4000], [9000, 4000], [9000, 6000], [0, 6000],
  ]
  const profiles = makeProfiles({ beam: { maxSpanMm: 2000, availableStockLengthsMm: [10000] } })
  const spec = baseSpec({ contour })
  const frame = computeFrame(spec, profiles)
  const result = segmentBeamsForStock(spec, frame, [], profiles, 0)

  const xOf = (z: number) =>
    result.posts
      .filter(p => Math.abs(p.position[2] - z) < 1)
      .map(p => Math.round(p.position[0]))
      .sort((a, b) => a - b)

  it('bottom (z=0) and top (z=6000) end up on the exact same set of X coordinates', () => {
    const bottomXs = xOf(0)
    const topXs = xOf(6000)
    expect(bottomXs).toEqual([0, 1500, 3000, 4500, 6000, 7500, 9000])
    expect(topXs).toEqual([0, 1500, 3000, 4500, 6000, 7500, 9000])
  })
})

describe('shape-wide post grid: plain rectangle regression — opposite sides still coincide (now by construction, not coincidence)', () => {
  const contour: Point2D[] = [[0, 0], [9000, 0], [9000, 6000], [0, 6000]]
  const profiles = makeProfiles({ beam: { maxSpanMm: 2000 } })
  const spec = baseSpec({ contour })
  const { posts } = computeFrame(spec, profiles)

  it('bottom and top intra posts share the same X set: {1800, 3600, 5400, 7200}', () => {
    const xs = (z: number) =>
      posts.filter(p => Math.abs(p.position[2] - z) < 1).map(p => Math.round(p.position[0])).sort((a, b) => a - b)
    expect(xs(0)).toEqual([0, 1800, 3600, 5400, 7200, 9000])
    expect(xs(6000)).toEqual([0, 1800, 3600, 5400, 7200, 9000])
  })

  it('left and right intra posts share the same Y set: {2000, 4000}', () => {
    const ys = (x: number) =>
      posts.filter(p => Math.abs(p.position[0] - x) < 1).map(p => Math.round(p.position[2])).sort((a, b) => a - b)
    expect(ys(0)).toEqual([0, 2000, 4000, 6000])
    expect(ys(9000)).toEqual([0, 2000, 4000, 6000])
  })
})

// ── 12. FrameResult.isOrthogonal — see prompt "честная плашка для
// неортогональных форм": exposed so callers/UI can warn the user that a
// non-orthogonal shape's post layout is only approximate (per-edge fallback,
// no shape-wide grid) instead of silently trusting it as exact. ────────────

describe('FrameResult.isOrthogonal', () => {
  it('plain rectangle → true', () => {
    const contour: Point2D[] = [[0, 0], [9000, 0], [9000, 6000], [0, 6000]]
    const profiles = makeProfiles()
    const { isOrthogonal } = computeFrame(baseSpec({ contour }), profiles)
    expect(isOrthogonal).toBe(true)
  })

  it('L-shape (right-angle corners only) → true', () => {
    const contour: Point2D[] = [
      [0, 0], [6000, 0], [6000, 3000], [3000, 3000], [3000, 6000], [0, 6000],
    ]
    const profiles = makeProfiles()
    const { isOrthogonal } = computeFrame(baseSpec({ contour }), profiles)
    expect(isOrthogonal).toBe(true)
  })

  it('trapezoid → false, but beams/posts are still a full, non-empty result (honest degradation, not a crash)', () => {
    const contour: Point2D[] = [[0, 0], [5000, 0], [4000, 3000], [1000, 3000]]
    const profiles = makeProfiles({ beam: { maxSpanMm: 6000 } })
    const { beams, posts, isOrthogonal } = computeFrame(baseSpec({ contour }), profiles)
    expect(isOrthogonal).toBe(false)
    expect(beams.length).toBe(4)
    expect(posts.length).toBe(4)
  })

  it('L-shape with one diagonal wall → false', () => {
    const contour: Point2D[] = [
      [0, 0], [6000, 0], [6000, 3000], [3000, 3000], [2600, 6000], [0, 6000],
    ]
    const profiles = makeProfiles()
    const { isOrthogonal } = computeFrame(baseSpec({ contour }), profiles)
    expect(isOrthogonal).toBe(false)
  })
})
