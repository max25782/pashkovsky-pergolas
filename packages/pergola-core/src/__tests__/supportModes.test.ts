import { describe, expect, it } from 'vitest'
import { computeFrame } from '../frame'
import { HANGER_LENGTH_MM } from '../support'
import { specFromPlan, buildPieces, planSupportType } from '../buildPieces'
import { DEFAULT_PLAN_CONSTRUCTION_PARAMS } from '../planDefaults'
import type { PergolaSpec, Point2D, ProfileDimensions } from '../types'

/**
 * Product fixture "600×400" is the plan size in centimetres. The kernel
 * is millimetres, so the rectangle is 6000×4000 mm.
 */
const RECT_600_400: Point2D[] = [
  [0, 0],
  [6000, 0],
  [6000, 4000],
  [0, 4000],
]

/**
 * L-shape: 6000×4000 outer box with a 3000×1500 notch on the top-right.
 * Vertices CCW: bottom-left → bottom-right → inner-right → inner corner →
 * top of stem → top-left.
 */
const L_SHAPE: Point2D[] = [
  [0, 0],
  [6000, 0],
  [6000, 2500],
  [3000, 2500],
  [3000, 4000],
  [0, 4000],
]

function makeProfiles(): Map<string, ProfileDimensions> {
  return new Map([
    ['beam-100', { widthMm: 40, heightMm: 100, maxSpanMm: 3000, availableStockLengthsMm: [6000, 7000] }],
    ['post-80', { widthMm: 80, heightMm: 80, availableStockLengthsMm: [4000] }],
    ['f7020', { widthMm: 70, heightMm: 20, maxLamellaSpanMm: 1500, availableStockLengthsMm: [6000] }],
    ['purlin-led-6040', {
      widthMm: 40,
      heightMm: 60,
      maxSpanMm: 3000,
      interruptsLamella: true,
      hasLedChannel: true,
      availableStockLengthsMm: [6000],
    }],
  ])
}

function spec(contour: Point2D[], overrides: Partial<PergolaSpec> = {}): PergolaSpec {
  return {
    contour,
    heightMm: 2600,
    lamellaGapMm: 20,
    lamellaAngleDeg: 0,
    lamellaDirectionDeg: 0,
    postProfileId: 'post-80',
    beamProfileId: 'beam-100',
    lamellaProfileId: 'f7020',
    color: '#9aa0a6',
    colorHex: '#9aa0a6',
    ...overrides,
  }
}

function nearPos(posts: { position: [number, number, number] }[], x: number, z: number): boolean {
  return posts.some((p) => Math.abs(p.position[0] - x) < 1 && Math.abs(p.position[2] - z) < 1)
}

describe('rectangle 600×400 (6000×4000 mm) — three support modes', () => {
  const profiles = makeProfiles()

  it('free-standing: 4 corners + maxSpan intermediates, symmetric on each side', () => {
    const { posts, hangers } = computeFrame(spec(RECT_600_400, { supportType: 'free-standing' }), profiles)
    expect(hangers).toHaveLength(0)
    expect(posts).toHaveLength(8)
    expect(nearPos(posts, 0, 0)).toBe(true)
    expect(nearPos(posts, 6000, 0)).toBe(true)
    expect(nearPos(posts, 6000, 4000)).toBe(true)
    expect(nearPos(posts, 0, 4000)).toBe(true)
    expect(nearPos(posts, 3000, 0)).toBe(true)
    expect(nearPos(posts, 3000, 4000)).toBe(true)
    expect(nearPos(posts, 6000, 2000)).toBe(true)
    expect(nearPos(posts, 0, 2000)).toBe(true)
  })

  it('posts alias matches free-standing', () => {
    const a = computeFrame(spec(RECT_600_400, { supportType: 'free-standing' }), profiles)
    const b = computeFrame(spec(RECT_600_400, { supportType: 'posts' }), profiles)
    expect(a.posts).toHaveLength(b.posts.length)
    expect(a.hangers).toHaveLength(0)
  })

  it('wall-mounted on edge 0: no posts on the wall edge, free sides keep posts', () => {
    const { posts, hangers, beams } = computeFrame(
      spec(RECT_600_400, { supportType: 'wall-mounted', wallEdgeIndices: [0] }),
      profiles,
    )
    expect(hangers).toHaveLength(0)
    expect(beams).toHaveLength(4)
    expect(nearPos(posts, 0, 0)).toBe(false)
    expect(nearPos(posts, 6000, 0)).toBe(false)
    expect(nearPos(posts, 3000, 0)).toBe(false)
    expect(nearPos(posts, 6000, 4000)).toBe(true)
    expect(nearPos(posts, 0, 4000)).toBe(true)
    expect(nearPos(posts, 3000, 4000)).toBe(true)
    expect(posts).toHaveLength(5)
  })

  it('hanging: no posts, hangers at every former support point', () => {
    const { posts, hangers } = computeFrame(spec(RECT_600_400, { supportType: 'hanging' }), profiles)
    expect(posts).toHaveLength(0)
    expect(hangers).toHaveLength(8)
    hangers.forEach((h) => {
      expect(h.role).toBe('hanger')
      expect(h.lengthAxisMm).toBe(HANGER_LENGTH_MM)
      expect(h.position[1]).toBe(2600)
    })
  })
})

describe('L-shape — three support modes', () => {
  const profiles = makeProfiles()

  it('free-standing: a post at every vertex; wing boundaries are not extra posts', () => {
    const { posts, hangers } = computeFrame(spec(L_SHAPE, { supportType: 'free-standing' }), profiles)
    expect(hangers).toHaveLength(0)
    expect(posts).toHaveLength(6)
    for (const [x, z] of L_SHAPE) {
      expect(nearPos(posts, x, z)).toBe(true)
    }
  })

  it('wall-mounted on the two building-corner edges (4 and 5): those edges have no posts', () => {
    const { posts } = computeFrame(
      spec(L_SHAPE, { supportType: 'wall-mounted', wallEdgeIndices: [4, 5] }),
      profiles,
    )
    expect(nearPos(posts, 3000, 4000)).toBe(false)
    expect(nearPos(posts, 0, 4000)).toBe(false)
    expect(nearPos(posts, 0, 0)).toBe(false)
    expect(nearPos(posts, 6000, 0)).toBe(true)
    expect(nearPos(posts, 6000, 2500)).toBe(true)
    expect(nearPos(posts, 3000, 2500)).toBe(true)
    expect(posts).toHaveLength(3)
  })

  it('hanging L: no posts, one hanger per vertex', () => {
    const { posts, hangers } = computeFrame(spec(L_SHAPE, { supportType: 'hanging' }), profiles)
    expect(posts).toHaveLength(0)
    expect(hangers).toHaveLength(6)
  })
})

describe('specFromPlan / buildPieces — one model', () => {
  it('promotes wall-mounted when the contour has wall edges', () => {
    expect(planSupportType({ supportType: 'free-standing' }, [0])).toBe('wall-mounted')
    expect(planSupportType({ supportType: 'hanging' }, [0])).toBe('hanging')
    expect(planSupportType({ supportType: 'free-standing' }, [])).toBe('free-standing')
  })

  it('writes height, angle, colorHex, supportType from plan params', () => {
    const built = specFromPlan({
      contour: RECT_600_400,
      wallEdgeIndices: [0],
      params: {
        ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
        heightMm: 2800,
        lamellaAngleDeg: 45,
        colorHex: 'RAL7016',
        supportType: 'free-standing',
      },
    })
    expect(built.heightMm).toBe(2800)
    expect(built.lamellaAngleDeg).toBe(45)
    expect(built.colorHex).toBe('RAL7016')
    expect(built.supportType).toBe('wall-mounted')
  })

  it('buildPieces includes hangers in hanging mode', () => {
    const result = buildPieces(
      spec(RECT_600_400, { supportType: 'hanging', purlinProfileId: 'purlin-led-6040' }),
      makeProfiles(),
    )
    expect(result.pieces.some((p) => p.role === 'hanger')).toBe(true)
    expect(result.pieces.some((p) => p.role === 'post')).toBe(false)
    expect(result.heightMm).toBe(2600)
  })
})
