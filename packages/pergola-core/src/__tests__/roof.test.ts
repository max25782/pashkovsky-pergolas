import { describe, expect, it } from 'vitest'
import { computeFrame } from '../frame'
import { buildPieces } from '../buildPieces'
import { heightOnPlane, roofPlane, slopedAxisLengthMm, ROOF_PLANE_RESIDUAL_WARN_MM } from '../roof'
import type { PergolaSpec, Point2D, ProfileDimensions } from '../types'

const RECT_600_400: Point2D[] = [
  [0, 0],
  [6000, 0],
  [6000, 4000],
  [0, 4000],
]

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
    purlinProfileId: 'purlin-led-6040',
    color: '#9aa0a6',
    colorHex: '#9aa0a6',
    ...overrides,
  }
}

function pieceSnapshot(pieces: { id: string; role: string; lengthAxisMm: number; position: number[]; rotation: number[] }[]) {
  return pieces.map((p) => ({
    id: p.id,
    role: p.role,
    lengthAxisMm: p.lengthAxisMm,
    position: p.position.map((n) => Math.round(n * 1000) / 1000),
    rotation: p.rotation.map((n) => Math.round(n * 1e6) / 1e6),
  }))
}

describe('roof slope — stage 5', () => {
  const profiles = makeProfiles()

  it('slope 0 produces the same pieces as a spec with no slope fields', () => {
    const flat = buildPieces(spec(RECT_600_400), profiles)
    const explicit = buildPieces(
      spec(RECT_600_400, { slope: { mode: 'deg', value: 0 }, highEdgeIndex: 0, postHeightOverridesMm: {} }),
      profiles,
    )
    expect(pieceSnapshot(explicit.pieces)).toEqual(pieceSnapshot(flat.pieces))
    expect(explicit.roof.warning).toBeNull()
    expect(explicit.roof.source).toBe('slope')
  })

  it('600×400, 10°, high side 6000 mm: post heights = heightMm − tan(10°)·y', () => {
    const drop = Math.tan((10 * Math.PI) / 180) * 4000
    const { posts, beams, roof } = computeFrame(
      spec(RECT_600_400, { slope: { mode: 'deg', value: 10 }, highEdgeIndex: 0 }),
      profiles,
    )
    expect(roof.source).toBe('slope')
    expect(roof.warning).toBeNull()

    const byPlan = (x: number, z: number) =>
      posts.find((p) => Math.abs(p.position[0] - x) < 1 && Math.abs(p.position[2] - z) < 1)

    expect(byPlan(0, 0)?.lengthAxisMm).toBeCloseTo(2600, 5)
    expect(byPlan(6000, 0)?.lengthAxisMm).toBeCloseTo(2600, 5)
    expect(byPlan(3000, 0)?.lengthAxisMm).toBeCloseTo(2600, 5)
    expect(byPlan(6000, 4000)?.lengthAxisMm).toBeCloseTo(2600 - drop, 5)
    expect(byPlan(0, 4000)?.lengthAxisMm).toBeCloseTo(2600 - drop, 5)
    expect(byPlan(3000, 4000)?.lengthAxisMm).toBeCloseTo(2600 - drop, 5)
    expect(byPlan(6000, 2000)?.lengthAxisMm).toBeCloseTo(2600 - drop / 2, 5)
    expect(byPlan(0, 2000)?.lengthAxisMm).toBeCloseTo(2600 - drop / 2, 5)

    const downhill = beams.find((b) =>
      Math.abs(b.position[0] - 6000) < 1 && Math.abs(b.position[2] - 0) < 1,
    )
    expect(downhill).toBeDefined()
    expect(downhill!.lengthAxisMm).toBeCloseTo(slopedAxisLengthMm(4000, (10 * Math.PI) / 180), 5)
  })

  it('one post override changes only that post; plane stays slope-based', () => {
    const { posts, roof } = computeFrame(
      spec(RECT_600_400, {
        slope: { mode: 'deg', value: 10 },
        highEdgeIndex: 0,
        postHeightOverridesMm: { 'post-0': 3000 },
      }),
      profiles,
    )
    expect(roof.source).toBe('slope')
    const overridden = posts.find((p) => p.id === 'post-0')
    expect(overridden?.lengthAxisMm).toBe(3000)
    const others = posts.filter((p) => p.id !== 'post-0')
    expect(others.length).toBeGreaterThan(0)
    for (const post of others) {
      const plan: Point2D = [post.position[0], post.position[2]]
      expect(post.lengthAxisMm).toBeCloseTo(heightOnPlane(roof, plan), 5)
    }
  })

  it('three non-collinear overrides fit a least-squares plane', () => {
    const overrides = {
      'post-0': 2800,
      'post-1': 2600,
      'post-3': 2400,
    }
    const { posts, roof } = computeFrame(
      spec(RECT_600_400, { postHeightOverridesMm: overrides }),
      profiles,
    )
    expect(roof.source).toBe('overrides')
    expect(roof.maxAbsResidualMm).toBeLessThan(1e-6)
    expect(roof.warning).toBeNull()

    const h00 = posts.find((p) => p.id === 'post-0')?.lengthAxisMm
    const h10 = posts.find((p) => p.id === 'post-1')?.lengthAxisMm
    const h03 = posts.find((p) => p.id === 'post-3')?.lengthAxisMm
    expect(h00).toBe(2800)
    expect(h10).toBe(2600)
    expect(h03).toBe(2400)

    const mid = posts.find((p) => p.id === 'post-2')
    expect(mid).toBeDefined()
    expect(mid!.lengthAxisMm).toBeCloseTo(heightOnPlane(roof, [mid!.position[0], mid!.position[2]]), 5)
    expect(mid!.lengthAxisMm).toBeCloseTo(2200, 5)
  })

  it('three overrides that are not coplanar warn when residual > 5 mm', () => {
    const plane = roofPlane(
      spec(RECT_600_400, {
        postHeightOverridesMm: {
          'post-0': 2800,
          'post-1': 2600,
          'post-2': 2000,
          'post-3': 2400,
        },
      }),
      [
        { id: 'post-0', plan: [0, 0] },
        { id: 'post-1', plan: [6000, 0] },
        { id: 'post-2', plan: [6000, 4000] },
        { id: 'post-3', plan: [0, 4000] },
      ],
    )
    expect(plane.source).toBe('overrides')
    expect(plane.maxAbsResidualMm).toBeGreaterThan(ROOF_PLANE_RESIDUAL_WARN_MM)
    expect(plane.warning).toMatch(/residual/i)
  })

  it('L-shape: every post sits on one slope plane', () => {
    const { posts, roof } = computeFrame(
      spec(L_SHAPE, { slope: { mode: 'deg', value: 10 }, highEdgeIndex: 0 }),
      profiles,
    )
    expect(posts.length).toBeGreaterThan(4)
    expect(roof.source).toBe('slope')
    for (const post of posts) {
      const expected = heightOnPlane(roof, [post.position[0], post.position[2]])
      expect(post.lengthAxisMm).toBeCloseTo(expected, 5)
    }
    const highs = posts.filter((p) => Math.abs(p.position[2]) < 1)
    const lows = posts.filter((p) => Math.abs(p.position[2] - 4000) < 1)
    expect(highs.length).toBeGreaterThan(0)
    expect(lows.length).toBeGreaterThan(0)
    for (const p of highs) expect(p.lengthAxisMm).toBeCloseTo(2600, 5)
    const drop = Math.tan((10 * Math.PI) / 180) * 4000
    for (const p of lows) expect(p.lengthAxisMm).toBeCloseTo(2600 - drop, 5)
  })

  it('hanging: no posts; hanger Y follows the plane', () => {
    const drop = Math.tan((10 * Math.PI) / 180) * 4000
    const { posts, hangers, roof } = computeFrame(
      spec(RECT_600_400, {
        supportType: 'hanging',
        slope: { mode: 'deg', value: 10 },
        highEdgeIndex: 0,
      }),
      profiles,
    )
    expect(posts).toHaveLength(0)
    expect(hangers.length).toBeGreaterThan(0)
    for (const h of hangers) {
      expect(h.position[1]).toBeCloseTo(heightOnPlane(roof, [h.position[0], h.position[2]]), 5)
    }
    const high = hangers.find((h) => Math.abs(h.position[2]) < 1)
    const low = hangers.find((h) => Math.abs(h.position[2] - 4000) < 1)
    expect(high?.position[1]).toBeCloseTo(2600, 5)
    expect(low?.position[1]).toBeCloseTo(2600 - drop, 5)
  })
})
