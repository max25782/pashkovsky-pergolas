import { describe, it, expect } from 'vitest'
import { computePurlins } from '../purlins'
import { segmentLedPurlinsForStock } from '../ledPurlinReversal'
import { packProfile, DEFAULT_KERF_MM, effectiveKerfMm } from '../packProfile'
import type { PergolaSpec, ProfileDimensions, Point2D } from '../types'

// Rectangle: lamellas run along X (dir), purlins run along Y (perp) — a
// contour depth (Y-extent) of 8000mm is longer than the 6000mm stock this
// LED profile is sold in, exactly the "не влезает" shape of bug this rule
// exists for (see prompt "ПРАВИЛО B — LED-БАЛКА").
const contour: Point2D[] = [[0, 0], [4000, 0], [4000, 8000], [0, 8000]]

function baseSpec(overrides: Partial<PergolaSpec> = {}): PergolaSpec {
  return {
    contour,
    heightMm: 2600,
    lamellaGapMm: 20,
    lamellaAngleDeg: 0,
    lamellaDirectionDeg: 0,
    postProfileId: 'post-1',
    beamProfileId: 'beam-1',
    lamellaProfileId: 'lam-1',
    purlinProfileId: 'purlin-led-1',
    color: '#FFFFFF',
    ...overrides,
  }
}

const PROFILES_TOO_LONG: Map<string, ProfileDimensions> = new Map([
  ['post-1', { widthMm: 80, heightMm: 80 }],
  ['beam-1', { widthMm: 40, heightMm: 100 }],
  ['lam-1', { widthMm: 70, heightMm: 20, maxLamellaSpanMm: 2000 }],
  ['purlin-led-1', {
    widthMm: 40, heightMm: 60,
    hasLedChannel: true,
    interruptsLamella: false,
    availableStockLengthsMm: [6000],
    maxLedStepMm: 1500,
  }],
])

describe('segmentLedPurlinsForStock — Rule B (90° reversal for an LED purlin longer than stock)', () => {
  it('leaves a non-LED purlin profile completely untouched — Rule A, not Rule B, handles that', () => {
    const profiles = new Map(PROFILES_TOO_LONG)
    profiles.set('purlin-plain-1', { widthMm: 40, heightMm: 60, availableStockLengthsMm: [6000] })
    const spec = baseSpec({ purlinProfileId: 'purlin-plain-1' })

    const result = segmentLedPurlinsForStock(spec, profiles)
    expect(result.reversed).toBe(false)
    expect(result.dividers).toEqual([])
    expect(result.issues).toEqual([])
    expect(result.purlins).toEqual(computePurlins(spec, profiles))
  })

  it('leaves an LED purlin that already fits stock untouched — no spurious divider', () => {
    const shortContour: Point2D[] = [[0, 0], [4000, 0], [4000, 5000], [0, 5000]] // depth 5000 < 6000 stock
    const profiles = new Map(PROFILES_TOO_LONG)
    const spec = baseSpec({ contour: shortContour })

    const result = segmentLedPurlinsForStock(spec, profiles)
    expect(result.reversed).toBe(false)
    expect(result.dividers).toEqual([])
    expect(result.purlins).toEqual(computePurlins(spec, profiles))
  })

  it('leaves an LED purlin with no availableStockLengthsMm untouched — honest gap, not a guess', () => {
    const profiles = new Map(PROFILES_TOO_LONG)
    profiles.set('purlin-led-1', { widthMm: 40, heightMm: 60, hasLedChannel: true })
    const spec = baseSpec()

    const result = segmentLedPurlinsForStock(spec, profiles)
    expect(result.reversed).toBe(false)
    expect(result.issues).toEqual([])
  })

  it('reverses: an 8000mm LED-purlin span over 6000mm stock gets ONE divider (2×4000mm sections) and a denser LED grid (maxLedStepMm=1500, not maxLamellaSpanMm=2000)', () => {
    const profiles = PROFILES_TOO_LONG
    const spec = baseSpec()

    // Sanity: computePurlins' OWN (un-reversed) grid really would be too
    // long — proves this test exercises the bug, not an already-fine case.
    const naive = computePurlins(spec, profiles)
    expect(naive.length).toBeGreaterThan(0)
    expect(naive[0].lengthAxisMm).toBeCloseTo(8000, 1)

    const result = segmentLedPurlinsForStock(spec, profiles, [], [], DEFAULT_KERF_MM)
    expect(result.reversed).toBe(true)
    expect(result.issues).toEqual([])

    // One divider, splitting 8000mm into 2×4000mm — the uniform fallback
    // (no existing posts/crossing pieces given) — running along X at y=4000.
    expect(result.dividers).toHaveLength(1)
    expect(result.dividers[0].lengthAxisMm).toBeCloseTo(4000, 1)
    expect(result.dividers[0].position[2]).toBeCloseTo(4000, 1) // Y (plan) → world Z
    expect(result.dividers[0].profileId).toBe('beam-1') // ledDividerProfileId unset ⇒ falls back to beamProfileId

    // Dense grid: maxLedStepMm=1500 over a 4000mm dir-extent ⇒ 2 columns
    // (not 1, which is what maxLamellaSpanMm=2000 alone would have given —
    // see the "denser than the structural grid" property this profile
    // field exists for) × 2 sections (top/bottom of the new divider) = 4
    // short LED purlins, none of them 8000mm.
    expect(result.purlins).toHaveLength(4)
    for (const p of result.purlins) {
      expect(p.lengthAxisMm).toBeCloseTo(4000, 1)
      expect(p.role).toBe('purlin')
      expect(p.profileId).toBe('purlin-led-1')
    }
    const dirPositions = [...new Set(result.purlins.map((p) => Math.round(p.position[0])))].sort((a, b) => a - b)
    expect(dirPositions).toHaveLength(2) // 2 dense dir-columns, not 1

    // End-to-end, the exact regression class this rule exists for (see
    // prompt "Прогон встал из-за 7000 + 5 > 7000"): pack every resulting
    // LED purlin through the REAL packProfile with the REAL kerf and
    // confirm it does not throw.
    expect(() => packProfile(result.purlins, 6000, DEFAULT_KERF_MM)).not.toThrow()
    for (const p of result.purlins) {
      const kerf = Math.max(
        effectiveKerfMm(DEFAULT_KERF_MM, p.cutMiterStartDeg, p.cutBevelStartDeg),
        effectiveKerfMm(DEFAULT_KERF_MM, p.cutMiterEndDeg, p.cutBevelEndDeg),
      )
      expect(p.lengthLongMm + kerf).toBeLessThanOrEqual(6000)
    }
  })

  it('reuses an existing post as the divider joint instead of the uniform-fallback midpoint, same priority as Rule A', () => {
    const profiles = PROFILES_TOO_LONG
    const spec = baseSpec()

    // A post at y=3000 (not the uniform midpoint 4000) sitting exactly on
    // the LED purlin's own line (x doesn't matter for a post — only its
    // own [x,z] needs to project onto the purlin's perp-axis, which for
    // dir=(1,0)/perp=(0,1) means matching z=3000 at ANY x since the purlin
    // itself spans the full x-range of the contour at each dense column;
    // projectOntoAxis checks perpendicular distance to the PURLIN's own
    // line, which for the representative rep-piece is the vertical line
    // x=2000 (its own anchor) — so the post must sit at x=2000, z=3000).
    const existingPost = {
      id: 'post-existing',
      role: 'post' as const,
      profileId: 'post-1',
      lengthAxisMm: 2600, lengthLongMm: 2600, lengthShortMm: 2600,
      cutMiterStartDeg: 0, cutBevelStartDeg: 0, cutHandStart: 'straight' as const,
      cutMiterEndDeg: 0, cutBevelEndDeg: 0, cutHandEnd: 'straight' as const,
      position: [2000, 0, 3000] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
      color: '#FFFFFF',
    }

    const result = segmentLedPurlinsForStock(spec, profiles, [existingPost], [], DEFAULT_KERF_MM)
    expect(result.reversed).toBe(true)
    expect(result.dividers).toHaveLength(1)
    expect(result.dividers[0].position[2]).toBeCloseTo(3000, 1) // reused the post's own depth, not the 4000 uniform midpoint
  })
})

// ── Regression for prompt "горизонтальные линии деления по крыльям" — Rule
// B's dividers are the SAME "division line" concern as computePurlins'
// crossing rows (see purlins.test.ts), just running perpendicular to them.
// A divider placed across the widest sparse crossing can legitimately land
// at an X that only has material in the SHORT wing of an L-shape — it must
// stop at that wing's own real height, not bleed into empty space at the
// tall wing's full height. ───────────────────────────────────────────────
describe('segmentLedPurlinsForStock — Rule B dividers on an L-shape respect each wing\'s own boundary, not the shape-wide bounding box', () => {
  // Tall wing: x∈[0,5000], full height 0..8500. Short wing: x∈[5000,9000],
  // only up to y=4054 (the step). Widest sparse crossing (rows below the
  // step) is 9000mm — over the 3200mm stock — so Rule B reverses and plans
  // dividers across it.
  const lShapeContour: Point2D[] = [
    [0, 0], [9000, 0], [9000, 4054], [5000, 4054], [5000, 8500], [0, 8500],
  ]
  const profiles: Map<string, ProfileDimensions> = new Map([
    ['post-1', { widthMm: 80, heightMm: 80 }],
    ['beam-1', { widthMm: 40, heightMm: 100 }],
    ['lam-1', { widthMm: 70, heightMm: 20, maxLamellaSpanMm: 1417 }],
    ['purlin-led-1', {
      widthMm: 40, heightMm: 60,
      hasLedChannel: true,
      interruptsLamella: false,
      availableStockLengthsMm: [3200],
      maxLedStepMm: 1500,
    }],
  ])
  const spec = baseSpec({ contour: lShapeContour, purlinProfileId: 'purlin-led-1', lamellaDirectionDeg: 90 })

  const result = segmentLedPurlinsForStock(spec, profiles, [], [], DEFAULT_KERF_MM)

  it('reverses and plans TWO dividers to fit the 9000mm widest row into 3200mm stock', () => {
    expect(result.reversed).toBe(true)
    expect(result.issues).toEqual([])
    expect(result.dividers).toHaveLength(2)
  })

  it('the divider landing INSIDE the short wing (x=6000, i.e. x>5000) stops at that wing\'s own height (4054mm) — not the tall wing\'s 8500mm', () => {
    const inShortWing = result.dividers.find((d) => d.position[0] > 5000 + 1)
    expect(inShortWing).toBeDefined()
    expect(inShortWing!.position[0]).toBeCloseTo(6000, 1)
    expect(inShortWing!.lengthAxisMm).toBeCloseTo(4054, 1) // clipped at the step — NOT 8500
  })

  it('the divider landing INSIDE the tall wing (x=3000, i.e. x<5000) legitimately spans the full 8500mm — real geometry, both wings coincide there', () => {
    const inTallWing = result.dividers.find((d) => d.position[0] <= 5000 + 1)
    expect(inTallWing).toBeDefined()
    expect(inTallWing!.position[0]).toBeCloseTo(3000, 1)
    expect(inTallWing!.lengthAxisMm).toBeCloseTo(8500, 1)
  })
})
