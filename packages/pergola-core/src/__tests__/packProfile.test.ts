import { describe, it, expect } from 'vitest'
import { packProfile, groupCutPiecesByBundle, effectiveKerfMm } from '../packProfile'
import { packPiecesIntoBars } from '../stockLength'
import { computeLamellas } from '../lamellas'
import type { CutPiece, PergolaSpec, ProfileDimensions, Point2D } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePiece(overrides: Partial<CutPiece> & { id: string; lengthAxisMm: number }): CutPiece {
  return {
    role: 'beam',
    profileId: 'f10040',
    lengthLongMm: overrides.lengthAxisMm,
    lengthShortMm: overrides.lengthAxisMm,
    cutMiterStartDeg: 0,
    cutBevelStartDeg: 0,
    cutHandStart: 'straight',
    cutMiterEndDeg: 0,
    cutBevelEndDeg: 0,
    cutHandEnd: 'straight',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    color: '#FFFFFF',
    ...overrides,
  }
}

// ── 1. Rectangle regression — straight cuts, matches hand-computed FFD ────────

describe('packProfile — rectangle regression (straight cuts)', () => {
  // lengthLong == lengthAxis for every piece (miter = bevel = 0), so this must
  // match a plain FFD-by-length-with-flat-kerf pack, computed by hand:
  //   sorted desc: 2000, 1800, 1600, 1400, 1200 · kerf 5 · stock 6000
  //   bar1: 2000+5=2005, +1800+5=1805→3810, +1600+5=1605→5415, next(1400+5=1405) → 6820 > 6000 skip,
  //         (1200+5=1205) → 6620 > 6000 skip ⇒ bar1 = [2000,1800,1600], used 5415, waste 585
  //   bar2: 1400+5=1405, +1200+5=1205→2610 ⇒ bar2 = [1400,1200], used 2610, waste 3390
  const lengths = [2000, 1800, 1600, 1400, 1200]
  const pieces = lengths.map((len, i) => makePiece({ id: `p${i}`, lengthAxisMm: len }))

  it('matches the hand-computed bar layout', () => {
    const plan = packProfile(pieces, 6000, 5)
    expect(plan.profileId).toBe('f10040')
    expect(plan.totalBars).toBe(2)
    expect(plan.bars[0].pieces.map((p) => p.lengthLongMm)).toEqual([2000, 1800, 1600])
    expect(plan.bars[0].usedMm).toBe(5415)
    expect(plan.bars[0].wasteMm).toBe(585)
    expect(plan.bars[1].pieces.map((p) => p.lengthLongMm)).toEqual([1400, 1200])
    expect(plan.bars[1].usedMm).toBe(2610)
    expect(plan.bars[1].wasteMm).toBe(3390)
    expect(plan.totalWasteMm).toBe(585 + 3390)
  })

  it('agrees with the existing flat-kerf packPiecesIntoBars when all cuts are straight', () => {
    const plan = packProfile(pieces, 6000, 5)
    const legacy = packPiecesIntoBars(lengths, 6000, 5)
    expect(plan.totalBars).toBe(legacy.length)
  })
})

// ── 2. Angled cut → effective kerf is LARGER than flat kerf ───────────────────

describe('packProfile — angled cut consumes more bar length than flat kerf', () => {
  // Piece A: 60° miter at start (cos 60° = 0.5) → effectiveKerf(10, 60, 0) = 20mm,
  // more than double the flat kerf. Piece B: straight, flat kerf 10mm.
  const A = makePiece({
    id: 'A', lengthAxisMm: 2000,
    cutMiterStartDeg: 60, cutHandStart: 'L',
  })
  const B = makePiece({ id: 'B', lengthAxisMm: 2000 })

  it('effectiveKerfMm(10, 60, 0) = 10 / cos(60°) = 20mm', () => {
    expect(effectiveKerfMm(10, 60, 0)).toBeCloseTo(20, 5)
  })

  it('effectiveKerfMm with miter=bevel=0 is just the flat kerf', () => {
    expect(effectiveKerfMm(10, 0, 0)).toBe(10)
  })

  it('flat-kerf packer says these two fit in one 4025mm bar, but the angle-aware packer needs two', () => {
    // Flat-kerf view (ignores the angle): 2000+10=2010 each, 2 pieces = 4020 ≤ 4025 → 1 bar.
    const legacy = packPiecesIntoBars([2000, 2000], 4025, 10)
    expect(legacy).toHaveLength(1)

    // Angle-aware view: A's slot is 2000+20=2020 (its 60° end dominates), B's is
    // 2000+10=2010. Sum = 4030 > 4025 → does NOT fit in one bar.
    const plan = packProfile([A, B], 4025, 10)
    expect(plan.totalBars).toBe(2)
  })
})

// ── 3. Long-point length governs fit, not axis length ──────────────────────────

describe('packProfile — packs by lengthLongMm, never under-orders on axis length alone', () => {
  it('a piece whose axis length fits but long-point length does not throws a clear error', () => {
    const piece = makePiece({ id: 'tight-miter', lengthAxisMm: 2990, lengthLongMm: 3010 })
    expect(() => packProfile([piece], 3000, 0)).toThrow(/tight-miter/)
    expect(() => packProfile([piece], 3000, 0)).toThrow(/3000mm/)
  })

  it('the same piece packs fine once the stock is long enough for the long-point length', () => {
    const piece = makePiece({ id: 'tight-miter', lengthAxisMm: 2990, lengthLongMm: 3010 })
    const plan = packProfile([piece], 3020, 0)
    expect(plan.totalBars).toBe(1)
    expect(plan.bars[0].usedMm).toBe(3010)
  })
})

// ── 4. Real trapeze (from computeLamellas) — long-point packing end-to-end ────
//
// A monotonicity check alone ("bigger stock ⇒ not more bars") is too weak: it
// passes for 18-vs-15, 18-vs-17, even 18-vs-18, so it cannot catch a packer
// that is systematically off by a bar or two, as long as it is off the same
// way at both stock lengths. This fixture instead pins the EXACT bar count at
// two stock lengths, derived analytically (independently of packProfile — see
// the geometry/FFD derivation below) and cross-checked with a standalone node
// script before being written into this test, so the expected numbers are not
// just "whatever the implementation happened to produce".
//
// GEOMETRY (chosen so every number is exact, no rounding):
//   Trapeze A(0,0) B(5200,0) C(3850,9000) D(1350,9000) — CCW.
//   halfTaper = 1350mm over H = 9000mm run ⇒ the slant edges make angle
//   alpha = atan(1350/9000) with the vertical, and — because
//   cutMiterDeg = asin(dot(lamellaDir, edgeDir)) collapses to exactly
//   atan(opposite/adjacent) for a lamellaDir ⊥ to the scan axis — every row's
//   miter is EXACTLY alpha ≈ 8.5308°, with tan(alpha) = 1350/9000 = 0.15
//   exactly (mathematical identity, not an approximation).
//   Row pitch 300mm (profile width 80mm + gap 220mm), scan range 0..9000mm,
//   first row center at Y=40mm ⇒ 30 rows (see row count assertion below),
//   row i's Y = 40 + 300i.
//
// ANALYTIC LENGTHS (independent of any core/packer code):
//   axisLenMm(row i)  = 5200 − 2×(1350/9000)×Y_i = 5200 − 0.3×(40+300i)
//                     = 5188 − 90i                              (i = 0..29)
//   longPointOffset per end = tan(alpha)×profileWidthMm/2 = 0.15×80/2 = 6mm
//   lengthLongMm(row i) = axisLenMm(row i) + 2×6 = 5200 − 90i
//   ⇒ sequence 5200, 5110, 5020, …, 2680, 2590 — already sorted descending,
//   so FFD's sort step is a no-op and the greedy placement can be traced by
//   hand (done below in the two stock-length derivations).
//
// FFD DERIVATION AT stockLengthMm=5300, kerf=0 (bin j's remaining capacity
// after its first item is 5300 − item = 100 + 90(j−1), which grows slower
// than items shrink until row 25; from row 25 on, four more rows each pair
// up with an EARLIER bin whose accumulated remaining finally caught up):
//   rows 0–24 (25 items, 5200..3040) → 25 bins, one item each.
//   row 25 (2950) → new bin 26 (no earlier bin's remaining ≥ 2950 yet).
//   row 26 (2860) → new bin 27.  row 27 (2770) → new bin 28.
//   row 28 (2680) → new bin 29, remaining 2620.
//   row 29 (2590) → fits bin 29 (2590 ≤ 2620) — the only pair that forms.
//   Total: 25 + 4 = 29 bins.
//
// FFD DERIVATION AT stockLengthMm=6000, kerf=0 (much more slack: bin j's
// remaining after its first item is 800 + 90(j−1), which overtakes the
// shrinking items around row 20, so FIVE pairs form instead of one):
//   rows 0–19 (20 items, 5200..3490) → 20 bins, one item each.
//   row 20 (3400) → new bin 21, remaining 2600.
//   row 21 (3310) → new bin 22, remaining 2690.
//   row 22 (3220) → new bin 23, remaining 2780.
//   row 23 (3130) → new bin 24, remaining 2870.
//   row 24 (3040) → new bin 25, remaining 2960.
//   row 25 (2950) → fits bin 25 (2950 ≤ 2960).
//   row 26 (2860) → fits bin 24 (2860 ≤ 2870) — bin 25 is now full (10mm left).
//   row 27 (2770) → fits bin 23 (2770 ≤ 2780).
//   row 28 (2680) → fits bin 22 (2680 ≤ 2690).
//   row 29 (2590) → fits bin 21 (2590 ≤ 2600).
//   Total: 25 bins (20 singles + 5 pairs), no bin 26 ever opens.
describe('packProfile — real angled lamellas from a trapeze pergola (exact bar counts)', () => {
  const PROFILE_W = 80
  const PROFILE_H = 25
  const profiles: Map<string, ProfileDimensions> = new Map([
    ['lam-80', { widthMm: PROFILE_W, heightMm: PROFILE_H }],
  ])
  const contour: Point2D[] = [[0, 0], [5200, 0], [3850, 9000], [1350, 9000]]
  const spec: PergolaSpec = {
    contour,
    lamellaDirectionDeg: 0,
    lamellaGapMm: 220, // pitch 300mm = profileW(80) + gap(220)
    lamellaAngleDeg: 0,
    heightMm: 3000,
    color: '#FFFFFF',
    postProfileId: 'post-unused',
    beamProfileId: 'beam-unused',
    lamellaProfileId: 'lam-80',
  }
  const lamellaPieces = computeLamellas(spec, profiles)

  const ALPHA_DEG = Math.atan(1350 / 9000) * (180 / Math.PI) // ≈ 8.5308°
  const near = (a: number, b: number, eps = 0.01) => expect(Math.abs(a - b)).toBeLessThan(eps)

  it('produces exactly 30 lamella rows', () => {
    expect(lamellaPieces).toHaveLength(30)
  })

  it('every row carries the same analytic miter angle and long-point offset (+6mm each end)', () => {
    lamellaPieces.forEach((p) => {
      near(p.cutMiterStartDeg, ALPHA_DEG, 0.02)
      near(p.cutMiterEndDeg, ALPHA_DEG, 0.02)
      near(p.lengthLongMm - p.lengthAxisMm, 12, 0.02) // 2 × 6mm
    })
  })

  it('sorted long-point lengths match the analytic arithmetic sequence 5200..2590 (step 90)', () => {
    const longs = lamellaPieces.map((p) => p.lengthLongMm).sort((a, b) => b - a)
    const expected = Array.from({ length: 30 }, (_, i) => 5200 - 90 * i)
    longs.forEach((len, i) => near(len, expected[i], 0.05))
  })

  it('EXACT bar count at stockLengthMm=5300, kerf=0: 29 bars', () => {
    const plan = packProfile(lamellaPieces, 5300, 0)
    expect(plan.totalBars).toBe(29)
    const packedCount = plan.bars.reduce((sum, b) => sum + b.pieces.length, 0)
    expect(packedCount).toBe(30)
  })

  it('EXACT bar count at stockLengthMm=6000, kerf=0: 25 bars', () => {
    const plan = packProfile(lamellaPieces, 6000, 0)
    expect(plan.totalBars).toBe(25)
    const packedCount = plan.bars.reduce((sum, b) => sum + b.pieces.length, 0)
    expect(packedCount).toBe(30)
  })

  it('additional monotonicity check (does NOT replace the exact counts above): 6000mm needs no more bars than 5300mm', () => {
    const at5300 = packProfile(lamellaPieces, 5300, 0)
    const at6000 = packProfile(lamellaPieces, 6000, 0)
    expect(at6000.totalBars).toBeLessThanOrEqual(at5300.totalBars)
  })

  it('used + waste reconcile exactly to bars × stockLength (no material unaccounted for)', () => {
    const plan = packProfile(lamellaPieces, 5300, 0)
    for (const bar of plan.bars) {
      expect(bar.usedMm + bar.wasteMm).toBe(bar.stockLengthMm)
    }
    expect(plan.totalWasteMm).toBe(plan.totalBars * 5300 - plan.bars.reduce((s, b) => s + b.usedMm, 0))
  })

  it('packed piece refs preserve the id and long-point length of their source CutPiece', () => {
    const plan = packProfile(lamellaPieces, 5300, 0)
    const bySourceId = new Map(lamellaPieces.map((p) => [p.id, p]))
    for (const bar of plan.bars) {
      for (const ref of bar.pieces) {
        const source = bySourceId.get(ref.pieceId)
        expect(source).toBeDefined()
        expect(ref.lengthLongMm).toBe(source!.lengthLongMm)
        expect(ref.cutMiterStartDeg).toBe(source!.cutMiterStartDeg)
        expect(ref.cutHandStart).toBe(source!.cutHandStart)
      }
    }
  })
})

// ── 5. Guardrails ───────────────────────────────────────────────────────────────

describe('packProfile — guardrails', () => {
  it('throws on mixed profileId input (grouping is the caller\'s responsibility)', () => {
    const a = makePiece({ id: 'a', lengthAxisMm: 1000, profileId: 'f10040' })
    const b = makePiece({ id: 'b', lengthAxisMm: 1000, profileId: 'f4020' })
    expect(() => packProfile([a, b], 6000, 0)).toThrow(/mixed profileId/)
  })

  it('throws on non-positive stockLengthMm', () => {
    const a = makePiece({ id: 'a', lengthAxisMm: 1000 })
    expect(() => packProfile([a], 0, 0)).toThrow(/stockLengthMm/)
  })

  it('returns an empty plan for an empty piece list', () => {
    const plan = packProfile([], 6000, 0)
    expect(plan.totalBars).toBe(0)
    expect(plan.bars).toEqual([])
    expect(plan.totalWasteMm).toBe(0)
  })
})

// ── 6. Bundle grouping (profile + color) ────────────────────────────────────────

describe('groupCutPiecesByBundle', () => {
  it('groups by profileId AND color — same profile in two colors is two bundles', () => {
    const anthracite = makePiece({ id: 'a1', lengthAxisMm: 1000, profileId: 'f10040', color: '#2B2B2B' })
    const white = makePiece({ id: 'a2', lengthAxisMm: 1000, profileId: 'f10040', color: '#FFFFFF' })
    const lamella = makePiece({ id: 'l1', lengthAxisMm: 1000, profileId: 'f4020', color: '#2B2B2B', role: 'lamella' })

    const groups = groupCutPiecesByBundle([anthracite, white, lamella])

    expect(groups.size).toBe(3)
    expect(groups.get('f10040::#2B2B2B')).toEqual([anthracite])
    expect(groups.get('f10040::#FFFFFF')).toEqual([white])
    expect(groups.get('f4020::#2B2B2B')).toEqual([lamella])
  })

  it('same profile+color across different roles land in the same bundle', () => {
    const beam = makePiece({ id: 'b1', lengthAxisMm: 3000, profileId: 'f10040', color: '#2B2B2B', role: 'beam' })
    const post = makePiece({ id: 'p1', lengthAxisMm: 2600, profileId: 'f10040', color: '#2B2B2B', role: 'post' })

    const groups = groupCutPiecesByBundle([beam, post])

    expect(groups.size).toBe(1)
    expect(groups.get('f10040::#2B2B2B')).toEqual([beam, post])
  })
})
