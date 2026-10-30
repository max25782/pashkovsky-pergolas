import { describe, expect, it } from 'vitest'
import { buildPieces, buildPiecesFromPlan, specFromPlan } from '../buildPieces'
import { computeFrame } from '../frame'
import { DEFAULT_PLAN_CONSTRUCTION_PARAMS } from '../planDefaults'
import { PERGOLA_CONSTRUCTION_PROFILES } from '../pergolaProfiles'
import { DEFAULT_KERF_MM } from '../packProfile'
import type { Point2D, ProfileDimensions } from '../types'

const LED_STOCK_6000: Map<string, ProfileDimensions> = new Map([
  ['post-1', { widthMm: 80, heightMm: 80 }],
  ['beam-1', { widthMm: 40, heightMm: 100, maxSpanMm: 5000, availableStockLengthsMm: [7000] }],
  ['lam-1', { widthMm: 70, heightMm: 20, maxLamellaSpanMm: 2000 }],
  ['f7020', { widthMm: 70, heightMm: 20, maxLamellaSpanMm: 2000 }],
  ['purlin-led-1', {
    widthMm: 40,
    heightMm: 60,
    hasLedChannel: true,
    interruptsLamella: true,
    availableStockLengthsMm: [6000],
  }],
])

describe('stock joints — long runs splice instead of throwing', () => {
  it('LED purlin 7019 mm / stock 6000 → two pieces, joint on a post, no throw', () => {
    const contour: Point2D[] = [[0, 0], [4000, 0], [4000, 7019], [0, 7019]]
    const spec = specFromPlan({
      contour,
      wallEdgeIndices: [],
      params: {
        ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
        beamProfileId: 'beam-1',
        postProfileId: 'post-1',
        purlinProfileId: 'purlin-led-1',
        lamellaPatternId: 'all-70',
        lamellaDirectionDeg: 0,
        postMaxSpanMm: 4000,
      },
    })
    spec.lamellaProfileId = 'lam-1'
    spec.purlinProfileId = 'purlin-led-1'
    spec.beamProfileId = 'beam-1'
    spec.postProfileId = 'post-1'

    expect(() => buildPieces(spec, LED_STOCK_6000, { kerfMm: DEFAULT_KERF_MM })).not.toThrow()
    const built = buildPieces(spec, LED_STOCK_6000, { kerfMm: DEFAULT_KERF_MM })
    const led = built.pieces.filter((p) => p.role === 'purlin' && p.profileId === 'purlin-led-1')
    expect(led.length).toBeGreaterThanOrEqual(2)
    for (const p of led) {
      expect(p.lengthLongMm + DEFAULT_KERF_MM).toBeLessThanOrEqual(6000 + 1)
    }
    expect(built.joints.length).toBeGreaterThan(0)
    const posts = built.pieces.filter((p) => p.role === 'post')
    for (const joint of built.joints.filter((j) => j.profileId === 'purlin-led-1')) {
      const onPost = posts.some(
        (post) => Math.hypot(post.position[0] - joint.position[0], post.position[2] - joint.position[1]) < 2,
      )
      expect(onPost).toBe(true)
    }
  })

  it('14 m and 20 m LED runs splice without a max compound-length cap', () => {
    for (const depth of [14_000, 20_000]) {
      const contour: Point2D[] = [[0, 0], [3000, 0], [3000, depth], [0, depth]]
      const spec = specFromPlan({
        contour,
        wallEdgeIndices: [],
        params: {
          ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
          beamProfileId: 'beam-1',
          postProfileId: 'post-1',
          purlinProfileId: 'purlin-led-1',
          lamellaDirectionDeg: 0,
          postMaxSpanMm: 4000,
        },
      })
      spec.lamellaProfileId = 'lam-1'
      spec.purlinProfileId = 'purlin-led-1'
      spec.beamProfileId = 'beam-1'
      spec.postProfileId = 'post-1'
      const built = buildPieces(spec, LED_STOCK_6000, { kerfMm: DEFAULT_KERF_MM })
      const led = built.pieces.filter((p) => p.role === 'purlin' && p.profileId === 'purlin-led-1')
      expect(led.length).toBeGreaterThanOrEqual(Math.ceil(depth / 6000))
      for (const p of led) {
        expect(p.lengthLongMm + DEFAULT_KERF_MM).toBeLessThanOrEqual(6000 + 1)
      }
    }
  })

  it('a splice with no nearby post plants an amud under the joint', () => {
    const contour: Point2D[] = [[0, 0], [2500, 0], [2500, 11_000], [0, 11_000]]
    const spec = specFromPlan({
      contour,
      wallEdgeIndices: [],
      params: {
        ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
        beamProfileId: 'beam-1',
        postProfileId: 'post-1',
        purlinProfileId: 'purlin-led-1',
        lamellaDirectionDeg: 0,
        postMaxSpanMm: 20_000,
      },
    })
    spec.lamellaProfileId = 'lam-1'
    spec.purlinProfileId = 'purlin-led-1'
    spec.beamProfileId = 'beam-1'
    spec.postProfileId = 'post-1'
    spec.postMaxSpanMm = 20_000

    const before = computeFrame(spec, LED_STOCK_6000)
    const built = buildPieces(spec, LED_STOCK_6000, { kerfMm: DEFAULT_KERF_MM })
    const postsAfter = built.pieces.filter((p) => p.role === 'post')
    expect(postsAfter.length).toBeGreaterThan(before.posts.length)
    expect(built.joints.length).toBeGreaterThan(0)
  })
})

describe('L-shape 3D build after stock splice', () => {
  it('Max L + LED does not throw and produces posts + purlins', () => {
    const contour: Point2D[] = [
      [0, 0],
      [5000, 0],
      [5000, 3500],
      [9000, 3500],
      [9000, 7500],
      [0, 7500],
    ]
    expect(() =>
      buildPiecesFromPlan(
        {
          contour,
          wallEdgeIndices: [],
          params: {
            ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
            postMaxSpanMm: 4000,
            purlinProfileId: 'purlin-led-6040',
          },
        },
        PERGOLA_CONSTRUCTION_PROFILES,
      ),
    ).not.toThrow()
    const built = buildPiecesFromPlan(
      {
        contour,
        wallEdgeIndices: [],
        params: {
          ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
          postMaxSpanMm: 4000,
          purlinProfileId: 'purlin-led-6040',
        },
      },
      PERGOLA_CONSTRUCTION_PROFILES,
    )
    expect(built.pieces.filter((p) => p.role === 'post').length).toBeGreaterThan(4)
    expect(built.pieces.some((p) => p.role === 'purlin')).toBe(true)
  })
})

describe('postMaxSpanMm versioning', () => {
  it('9000 mm edge at 4000 mm step → 2 intermediate posts (3 spans ≤ 4000)', () => {
    const contour: Point2D[] = [[0, 0], [9000, 0], [9000, 3000], [0, 3000]]
    const spec = specFromPlan({
      contour,
      wallEdgeIndices: [],
      params: { ...DEFAULT_PLAN_CONSTRUCTION_PARAMS, postMaxSpanMm: 4000 },
    })
    const frame = computeFrame(spec, PERGOLA_CONSTRUCTION_PROFILES)
    const bottom = frame.posts.filter((p) => Math.abs(p.position[2]) < 2)
    expect(bottom.length).toBe(4)
    const xs = bottom.map((p) => p.position[0]).sort((a, b) => a - b)
    expect(xs[0]).toBeCloseTo(0, 0)
    expect(xs[xs.length - 1]).toBeCloseTo(9000, 0)
    for (let i = 0; i + 1 < xs.length; i++) {
      expect(xs[i + 1] - xs[i]).toBeLessThanOrEqual(4000 + 1)
    }
  })

  it('saved plan without postMaxSpanMm keeps the beam-profile (legacy) step', () => {
    const contour: Point2D[] = [[0, 0], [9000, 0], [9000, 3000], [0, 3000]]
    const legacy = specFromPlan({
      contour,
      wallEdgeIndices: [],
      params: { ...DEFAULT_PLAN_CONSTRUCTION_PARAMS },
    })
    delete legacy.postMaxSpanMm
    const frame = computeFrame(legacy, PERGOLA_CONSTRUCTION_PROFILES)
    const bottom = frame.posts.filter((p) => Math.abs(p.position[2]) < 2)
    const beamSpan = PERGOLA_CONSTRUCTION_PROFILES.get('f10040')!.maxSpanMm!
    expect(beamSpan).toBeGreaterThan(4000)
    const xs = bottom.map((p) => p.position[0]).sort((a, b) => a - b)
    for (let i = 0; i + 1 < xs.length; i++) {
      expect(xs[i + 1] - xs[i]).toBeLessThanOrEqual(beamSpan + 1)
    }
    expect(bottom.length).toBeLessThan(4)
  })
})
