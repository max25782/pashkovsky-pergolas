import { describe, it, expect } from 'vitest'
import { computePurlins } from '../purlins'
import type { PergolaSpec, ProfileDimensions, Point2D } from '../types'

// ── Regression tests for prompt "горизонтальные линии деления по крыльям,
// как вертикальные" — a purlin (crossing member perpendicular to the
// lamellas) is the actual "division line" mechanism in this codebase; each
// crossing line is independently clipped against the REAL contour via
// scanLineClip (see purlins.ts docstring), so it can legitimately come back
// as several disjoint pieces or stop short of the shape's outer bounding
// box — this is what makes a division line respect wing/notch boundaries
// instead of crossing the whole shape-wide bounding rectangle regardless of
// whether material is actually there.
//
// Note on `position[0]`: computePurlins records the START of a piece at the
// hit with the SMALLER scan parameter along `perp`; for lamellaDirectionDeg
// = 90 (perp = (-1, 0)) that is always the piece's RIGHTMOST x, extending
// toward smaller x. So "starts from the wing boundary" below means
// position[0] lands exactly on a true contour boundary (the step x, or an
// outer wall) — never on an arbitrary interior/midpoint x. ─────────────────

function makeProfiles(overrides: {
  beam?: Partial<ProfileDimensions>
  lam?: Partial<ProfileDimensions>
  purlin?: Partial<ProfileDimensions>
} = {}): Map<string, ProfileDimensions> {
  return new Map([
    ['beam-1', { widthMm: 40, heightMm: 100, ...overrides.beam }],
    ['post-1', { widthMm: 80, heightMm: 80 }],
    ['lam-1', { widthMm: 70, heightMm: 20, maxLamellaSpanMm: 1500, ...overrides.lam }],
    ['purlin-1', { widthMm: 30, heightMm: 50, interruptsLamella: false, ...overrides.purlin }],
  ])
}

function baseSpec(overrides: Partial<PergolaSpec> = {}): PergolaSpec {
  return {
    contour: [],
    heightMm: 2600,
    lamellaGapMm: 20,
    lamellaAngleDeg: 0,
    lamellaDirectionDeg: 90, // lamellas run along Y ⇒ purlins run along X — HORIZONTAL division rows, positioned by Y (the "row of intermediate posts by height" the bug report describes).
    postProfileId: 'post-1',
    beamProfileId: 'beam-1',
    lamellaProfileId: 'lam-1',
    purlinProfileId: 'purlin-1',
    color: '#FFFFFF',
    ...overrides,
  }
}

describe('computePurlins — L-shape: horizontal division row clipped at the wing boundary, not bleeding into the narrow wing', () => {
  // Same L-shape as the bug report: left wing full height 8500mm (0..8500),
  // right wing only the bottom strip up to 4054mm (0..4054), step at x=5000.
  const contour: Point2D[] = [
    [0, 0], [9000, 0], [9000, 4054], [5000, 4054], [5000, 8500], [0, 8500],
  ]
  const profiles = makeProfiles({ lam: { maxLamellaSpanMm: 1417 } }) // forces division rows above y=4054 too
  const spec = baseSpec({ contour })
  const purlins = computePurlins(spec, profiles)

  it('produces at least one row strictly above the narrow wing (y > 4054)', () => {
    expect(purlins.some((p) => p.position[2] > 4054 + 1)).toBe(true)
  })

  it('every row above y=4054 stops at the step (x=5000) — it does NOT continue into the narrow wing to x=9000', () => {
    const rowsAboveStep = purlins.filter((p) => p.position[2] > 4054 + 1)
    expect(rowsAboveStep.length).toBeGreaterThan(0)
    for (const row of rowsAboveStep) {
      expect(row.lengthAxisMm).toBeCloseTo(5000, 1) // 0..5000, not 0..9000
      expect(row.position[0]).toBeCloseTo(5000, 1) // starts exactly at the step, the real wing boundary
    }
  })

  it('a row at y ≤ 4054, where BOTH wings genuinely share that width, legitimately spans the full 9000mm — real geometry, not a leak', () => {
    const rowsBelowStep = purlins.filter((p) => p.position[2] <= 4054 + 1)
    expect(rowsBelowStep.length).toBeGreaterThan(0)
    for (const row of rowsBelowStep) {
      expect(row.lengthAxisMm).toBeCloseTo(9000, 1)
      expect(row.position[0]).toBeCloseTo(9000, 1) // starts at the real right outer wall
    }
  })
})

describe('computePurlins — plain rectangle regression: no step to clip against, row still spans the full width', () => {
  const contour: Point2D[] = [[0, 0], [9000, 0], [9000, 8500], [0, 8500]]
  const profiles = makeProfiles({ lam: { maxLamellaSpanMm: 1417 } })
  const spec = baseSpec({ contour })
  const purlins = computePurlins(spec, profiles)

  it('every row spans the full 9000mm width, starting at the real outer wall', () => {
    expect(purlins.length).toBeGreaterThan(0)
    for (const row of purlins) {
      expect(row.lengthAxisMm).toBeCloseTo(9000, 1)
      expect(row.position[0]).toBeCloseTo(9000, 1)
    }
  })
})

describe('computePurlins — U-shape: rows above the bridge appear as two separate tower segments, not one beam bleeding through the notch', () => {
  // Bottom bridge spans the full width (0..9000) up to y=3000. Above that,
  // only two towers remain, open at the top: left x∈[0,3000], right
  // x∈[6000,9000]; the middle notch x∈(3000,6000) above y=3000 is empty.
  const contour: Point2D[] = [
    [0, 0], [9000, 0], [9000, 8000], [6000, 8000], [6000, 3000],
    [3000, 3000], [3000, 8000], [0, 8000],
  ]
  const profiles = makeProfiles({ lam: { maxLamellaSpanMm: 900 } })
  const spec = baseSpec({ contour })
  const purlins = computePurlins(spec, profiles)

  it('rows above the bridge (y > 3000) come back as TWO disjoint 3000mm pieces per row, not one 9000mm beam through the notch', () => {
    const rowsAboveBridge = purlins.filter((p) => p.position[2] > 3000 + 1)
    expect(rowsAboveBridge.length).toBeGreaterThan(0)

    const byY = new Map<number, typeof purlins>()
    for (const row of rowsAboveBridge) {
      const y = Math.round(row.position[2] / 10) * 10 // bucket tiny fp noise from evenly-spaced division points
      byY.set(y, [...(byY.get(y) ?? []), row])
    }
    expect(byY.size).toBeGreaterThan(0)
    for (const [, rowsAtThisY] of byY) {
      expect(rowsAtThisY).toHaveLength(2)
      const lengths = rowsAtThisY.map((r) => Math.round(r.lengthAxisMm)).sort((a, b) => a - b)
      expect(lengths).toEqual([3000, 3000]) // left tower width, right tower width — never 9000
      const xs = rowsAtThisY.map((r) => Math.round(r.position[0])).sort((a, b) => a - b)
      expect(xs).toEqual([3000, 9000]) // each piece starts exactly at ITS OWN tower's outer wall
    }
  })

  it('a row within the bridge (y ≤ 3000) legitimately spans the full 9000mm — real geometry', () => {
    const rowsInBridge = purlins.filter((p) => p.position[2] <= 3000 + 1)
    expect(rowsInBridge.length).toBeGreaterThan(0)
    for (const row of rowsInBridge) {
      expect(row.lengthAxisMm).toBeCloseTo(9000, 1)
    }
  })
})
