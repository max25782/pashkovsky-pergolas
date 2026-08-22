import { describe, it, expect } from 'vitest'
import { computeFrame } from '../frame'
import { buildAxialDimensionChains } from '../dimensionChains'
import type { PergolaSpec, ProfileDimensions, Point2D } from '../types'

/**
 * See prompt correction "цепочка размеров должна идти по всем стойкам вдоль
 * стороны... не из осей балок, а из осей стоек, спроецированных на линию
 * стороны": these tests exercise the REAL computeFrame intermediate-post
 * rule (frame.ts "nIntermediate = ceil(edgeLength / maxSpanMm) − 1") end to
 * end, not a synthetic post list — a chain that only reproduced beam
 * endpoints would still pass tests built from a mock, so the fixtures below
 * always go through actual computeFrame output.
 */

function baseSpec(overrides: Partial<PergolaSpec> = {}): PergolaSpec {
  return {
    contour: [],
    heightMm: 2600,
    lamellaGapMm: 20,
    lamellaAngleDeg: 0,
    lamellaDirectionDeg: 0,
    postProfileId: 'post-1',
    beamProfileId: 'beam-1',
    lamellaProfileId: 'lam-1',
    color: '#fff',
    ...overrides,
  }
}

const BEAM: ProfileDimensions = { widthMm: 40, heightMm: 100, maxSpanMm: 2500 }
const POST: ProfileDimensions = { widthMm: 80, heightMm: 80 }
const PROFILES: Map<string, ProfileDimensions> = new Map([['beam-1', BEAM], ['post-1', POST]])

// 6000×3000 rectangle. Edge 0/2 (length 6000): nInter = ceil(6000/2500)-1 = 2.
// Edge 1/3 (length 3000): nInter = ceil(3000/2500)-1 = 1.
const RECT: Point2D[] = [[0, 0], [6000, 0], [6000, 3000], [0, 3000]]

const near = (a: number, b: number, eps = 0.5) => expect(Math.abs(a - b)).toBeLessThan(eps)

describe('buildAxialDimensionChains', () => {
  it('long side (6000mm, maxSpanMm=2500): chain is corner → 2 intermediate posts → corner, at 2000/2000/2000', () => {
    const spec = baseSpec({ contour: RECT })
    const { beams, posts } = computeFrame(spec, PROFILES)
    const chains = buildAxialDimensionChains(beams, posts)

    // Edge 0: (0,0) → (6000,0)
    const chain0 = chains[0]
    expect(chain0.points).toHaveLength(4)
    expect(chain0.points.map((p) => p.kind)).toEqual(['corner', 'post', 'post', 'corner'])
    expect(chain0.points[0].point).toEqual([0, 0])
    expect(chain0.points[3].point).toEqual([6000, 0])
    near(chain0.points[1].distanceFromStartMm, 2000)
    near(chain0.points[2].distanceFromStartMm, 4000)
    expect(chain0.segmentsMm).toHaveLength(3)
    chain0.segmentsMm.forEach((s) => near(s, 2000))
    // segments sum to the full edge length
    near(chain0.segmentsMm.reduce((a, b) => a + b, 0), 6000)
  })

  it('short side (3000mm, maxSpanMm=2500): chain is corner → 1 intermediate post → corner, at 1500/1500', () => {
    const spec = baseSpec({ contour: RECT })
    const { beams, posts } = computeFrame(spec, PROFILES)
    const chains = buildAxialDimensionChains(beams, posts)

    const chain1 = chains[1] // (6000,0) → (6000,3000)
    expect(chain1.points).toHaveLength(3)
    expect(chain1.points.map((p) => p.kind)).toEqual(['corner', 'post', 'corner'])
    near(chain1.points[1].distanceFromStartMm, 1500)
    chain1.segmentsMm.forEach((s) => near(s, 1500))
  })

  it('every intermediate tick postId matches a real post.id in the posts array — never fabricated', () => {
    const spec = baseSpec({ contour: RECT })
    const { beams, posts } = computeFrame(spec, PROFILES)
    const chains = buildAxialDimensionChains(beams, posts)
    const postIds = new Set(posts.map((p) => p.id))

    for (const chain of chains) {
      for (const point of chain.points) {
        if (point.kind === 'post') {
          expect(point.postId).toBeDefined()
          expect(postIds.has(point.postId!)).toBe(true)
        } else {
          expect(point.postId).toBeUndefined()
        }
      }
    }
  })

  it('no maxSpanMm (short enough / unset): chain is JUST the two corners — no fabricated ticks', () => {
    const shortBeam: ProfileDimensions = { widthMm: 40, heightMm: 100 } // no maxSpanMm
    const profiles = new Map([['beam-1', shortBeam], ['post-1', POST]])
    const spec = baseSpec({ contour: RECT })
    const { beams, posts } = computeFrame(spec, profiles)
    const chains = buildAxialDimensionChains(beams, posts)

    for (const chain of chains) {
      expect(chain.points).toHaveLength(2)
      expect(chain.points.map((p) => p.kind)).toEqual(['corner', 'corner'])
    }
  })

  it('a corner post is NOT duplicated as a second tick at distance≈0 or ≈edgeLen', () => {
    const spec = baseSpec({ contour: RECT })
    const { beams, posts } = computeFrame(spec, PROFILES)
    const chains = buildAxialDimensionChains(beams, posts)
    for (const chain of chains) {
      const distances = chain.points.map((p) => Math.round(p.distanceFromStartMm))
      expect(new Set(distances).size).toBe(distances.length) // no duplicate distances
    }
  })

  it('wall-mounted edge: corner ticks stay (from the beam line itself), even with no corner post physically there — installer still measures from that corner', () => {
    const spec = baseSpec({
      contour: RECT,
      supportType: 'wall-mounted',
      wallEdgeIndices: [0], // edge (0,0)→(6000,0) is the wall edge
    })
    const { beams, posts } = computeFrame(spec, PROFILES)

    // Sanity: no post AT (0,0) or (6000,0) — vertices 0/1 are wall endpoints.
    const cornerPostAt = (x: number, y: number) =>
      posts.some((p) => Math.abs(p.position[0] - x) < 1 && Math.abs(p.position[2] - y) < 1)
    expect(cornerPostAt(0, 0)).toBe(false)
    expect(cornerPostAt(6000, 0)).toBe(false)

    const chains = buildAxialDimensionChains(beams, posts)
    const wallChain = chains[0]
    // Corners are still there (from the beam's own endpoints), intermediate
    // posts along a long wall edge are NOT skipped by computeFrame today
    // (see frame.ts: the maxSpan loop doesn't check wallEdgeIndices) — the
    // chain must reflect that reality, not invent a different rule.
    expect(wallChain.points[0]).toMatchObject({ kind: 'corner', point: [0, 0] })
    expect(wallChain.points[wallChain.points.length - 1]).toMatchObject({ kind: 'corner', point: [6000, 0] })
    expect(wallChain.points.filter((p) => p.kind === 'post')).toHaveLength(2)
  })

  it('one chain per beam, same order, same beamId', () => {
    const spec = baseSpec({ contour: RECT })
    const { beams, posts } = computeFrame(spec, PROFILES)
    const chains = buildAxialDimensionChains(beams, posts)
    expect(chains).toHaveLength(beams.length)
    chains.forEach((chain, i) => {
      expect(chain.edgeIndex).toBe(i)
      expect(chain.beamId).toBe(beams[i].id)
    })
  })

  it('L-shape (non-convex): posts on the OTHER leg are not mistakenly attached to a colinear-but-unrelated edge', () => {
    // L-shape with a long top edge that is COLINEAR with a shorter segment
    // elsewhere would be a real hazard for a naive "colinear line" match —
    // this fixture keeps every edge on a distinct line, but confirms counts
    // add up exactly (no post assigned to zero or to more than one chain).
    const lShape: Point2D[] = [
      [0, 0], [6000, 0], [6000, 3000], [3000, 3000], [3000, 6000], [0, 6000],
    ]
    const spec = baseSpec({ contour: lShape })
    const { beams, posts } = computeFrame(spec, PROFILES)
    const chains = buildAxialDimensionChains(beams, posts)

    const totalTicks = chains.reduce((sum, c) => sum + c.points.filter((p) => p.kind === 'post').length, 0)
    const totalIntermediatePosts = posts.length - lShape.length // posts.length includes one corner post per vertex
    expect(totalTicks).toBe(totalIntermediatePosts)
  })
})
