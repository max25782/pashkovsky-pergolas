import { buildProfileBundlePlans, buildOrderSheetTotals, getChosenPlan, DEFAULT_KERF_MM } from '../order-sheet'
import type { CutPiece, ProfileDimensions } from '@pashkovsky/pergola-core'

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
    color: '#2B2B2B',
    ...overrides,
  }
}

describe('buildProfileBundlePlans', () => {
  const profiles: Map<string, ProfileDimensions> = new Map([
    ['f10040', { widthMm: 40, heightMm: 100, availableStockLengthsMm: [6000, 7000], weightKgPerMeter: 1.8 }],
    ['f4020', { widthMm: 40, heightMm: 20, availableStockLengthsMm: [6000] }], // no weight configured
    ['f8080', { widthMm: 80, heightMm: 80 }], // no availableStockLengthsMm at all (posts in DEMO_PROFILES)
  ])

  it('groups by profile+color into separate bundles, one per RAL — "разные заказы"', () => {
    const anthracite = [
      makePiece({ id: 'b1', lengthAxisMm: 2000, profileId: 'f10040', color: '#2B2B2B' }),
      makePiece({ id: 'b2', lengthAxisMm: 3000, profileId: 'f10040', color: '#2B2B2B' }),
    ]
    const white = [makePiece({ id: 'b3', lengthAxisMm: 2500, profileId: 'f10040', color: '#FFFFFF' })]

    const plans = buildProfileBundlePlans([...anthracite, ...white], profiles)

    expect(plans).toHaveLength(2)
    const anthraciteBundle = plans.find((p) => p.color === '#2B2B2B')!
    const whiteBundle = plans.find((p) => p.color === '#FFFFFF')!
    expect(anthraciteBundle.pieceCount).toBe(2)
    expect(anthraciteBundle.totalLengthLongMm).toBe(5000)
    expect(whiteBundle.pieceCount).toBe(1)
  })

  it('computes one packProfile option per availableStockLengthsMm, ascending, with a recommended pick', () => {
    const pieces = [
      makePiece({ id: 'b1', lengthAxisMm: 4000 }),
      makePiece({ id: 'b2', lengthAxisMm: 3500 }),
      makePiece({ id: 'b3', lengthAxisMm: 2200 }),
    ]
    const [bundle] = buildProfileBundlePlans(pieces, profiles, 5)

    expect(bundle.options.map((o) => o.stockLengthMm)).toEqual([6000, 7000])
    // 4000+5=4005, 3500+5=3505, 2200+5=2205 → at 6000: bar1=[4000] (waste 1995,
    // next 3500 doesn't fit: 4005+3505=7510>6000), bar2=[3500,2200] used 5710+... let's
    // just assert internal consistency instead of re-deriving FFD by hand here (see
    // packProfile.test.ts in pergola-core for the hand-derived exact-count coverage).
    const at6000 = bundle.options.find((o) => o.stockLengthMm === 6000)!.plan!
    const at7000 = bundle.options.find((o) => o.stockLengthMm === 7000)!.plan!
    expect(at6000.totalBars).toBeGreaterThan(0)
    expect(at7000.totalBars).toBeGreaterThan(0)
    expect(bundle.recommendedStockLengthMm).not.toBeNull()
    // 7000mm fits all three pieces in one bar (4005+3505+2205=9715>7000 → still 2 bars,
    // but at minimum 7000 can never need MORE bars than 6000 for the same pieces).
    expect(at7000.totalBars).toBeLessThanOrEqual(at6000.totalBars)
  })

  it('leaves options empty (not fabricated) for a profile with no availableStockLengthsMm — e.g. posts', () => {
    const posts = [makePiece({ id: 'p1', lengthAxisMm: 2600, profileId: 'f8080', role: 'post' })]
    const [bundle] = buildProfileBundlePlans(posts, profiles)

    expect(bundle.options).toEqual([])
    expect(bundle.recommendedStockLengthMm).toBeNull()
    expect(bundle.pieceCount).toBe(1) // piece count/total length still reported
  })

  it('carries profile dimensions and weight through when the catalog has them, undefined otherwise', () => {
    const beam = [makePiece({ id: 'b1', lengthAxisMm: 3000, profileId: 'f10040' })]
    const lamella = [makePiece({ id: 'l1', lengthAxisMm: 1200, profileId: 'f4020', role: 'lamella' })]
    const plans = buildProfileBundlePlans([...beam, ...lamella], profiles)

    const beamBundle = plans.find((p) => p.profileId === 'f10040')!
    const lamellaBundle = plans.find((p) => p.profileId === 'f4020')!
    expect(beamBundle.weightKgPerMeter).toBe(1.8)
    expect(beamBundle.profileWidthMm).toBe(40)
    expect(lamellaBundle.weightKgPerMeter).toBeUndefined()
  })

  it('uses DEFAULT_KERF_MM when kerfMm is not passed', () => {
    const pieces = [makePiece({ id: 'b1', lengthAxisMm: 4000 })]
    const [bundle] = buildProfileBundlePlans(pieces, profiles)
    const [bundleExplicit] = buildProfileBundlePlans(pieces, profiles, DEFAULT_KERF_MM)
    expect(bundle.options[0].plan!.bars[0].usedMm).toBe(bundleExplicit.options[0].plan!.bars[0].usedMm)
  })

  // Regression for a real crash caught by visually opening the Order/Cutting
  // sheet on an actual L-shaped pergola (see chat): an 8.7m perimeter beam
  // against a [6000, 7000]mm catalog made packProfile() throw for BOTH
  // options, and that throw was uncaught here — it crashed the whole sheet
  // (both Order and Cutting tabs) instead of showing "doesn't fit" on the
  // offending row(s). Twenty passing unit tests never used a piece longer
  // than any catalog stock length, so none of them caught this.
  it('does not throw when a piece is longer than one available stock length but fits a longer one — marks only that option as failed', () => {
    const pieces = [makePiece({ id: 'b-long', lengthAxisMm: 6500 })] // fits 7000mm, not 6000mm
    const [bundle] = buildProfileBundlePlans(pieces, profiles, 0)

    const at6000 = bundle.options.find((o) => o.stockLengthMm === 6000)!
    const at7000 = bundle.options.find((o) => o.stockLengthMm === 7000)!
    expect(at6000.plan).toBeNull()
    expect(at6000.error).toMatch(/b-long/)
    expect(at7000.plan).not.toBeNull()
    expect(at7000.error).toBeNull()
    // The failed 6000mm option must not have suppressed the recommendation —
    // the only WORKING option (7000mm) is still picked.
    expect(bundle.recommendedStockLengthMm).toBe(7000)
  })

  it('does not throw when a piece is longer than EVERY available stock length — all options fail, no recommendation', () => {
    const pieces = [makePiece({ id: 'b-toolong', lengthAxisMm: 8720 })] // longer than both 6000 and 7000mm
    const [bundle] = buildProfileBundlePlans(pieces, profiles, 0)

    expect(bundle.options).toHaveLength(2)
    expect(bundle.options.every((o) => o.plan === null)).toBe(true)
    expect(bundle.options.every((o) => o.error != null)).toBe(true)
    expect(bundle.recommendedStockLengthMm).toBeNull()
    // Piece count/total length are still honestly reported even though no
    // plan could be built — same "don't hide the real numbers" rule as the
    // no-availableStockLengthsMm case above.
    expect(bundle.pieceCount).toBe(1)
  })
})

describe('getChosenPlan', () => {
  const profiles: Map<string, ProfileDimensions> = new Map([
    ['f10040', { widthMm: 40, heightMm: 100, availableStockLengthsMm: [6000, 7000] }],
  ])
  const pieces = [makePiece({ id: 'b1', lengthAxisMm: 5000 })]
  const [bundle] = buildProfileBundlePlans(pieces, profiles)

  it('falls back to the recommended length when the user made no explicit choice', () => {
    const plan = getChosenPlan(bundle, new Map())
    expect(plan).not.toBeNull()
    expect(plan!.stockLengthMm).toBe(bundle.recommendedStockLengthMm)
  })

  it('honours an explicit user choice over the recommendation', () => {
    const nonRecommended = bundle.options.find((o) => o.stockLengthMm !== bundle.recommendedStockLengthMm)!.stockLengthMm
    const plan = getChosenPlan(bundle, new Map([[bundle.bundleKey, nonRecommended]]))
    expect(plan!.stockLengthMm).toBe(nonRecommended)
  })

  it('returns null when the bundle has no stock options at all', () => {
    const noStockProfiles: Map<string, ProfileDimensions> = new Map([['f8080', { widthMm: 80, heightMm: 80 }]])
    const posts = [makePiece({ id: 'p1', lengthAxisMm: 2600, profileId: 'f8080', role: 'post' })]
    const [postBundle] = buildProfileBundlePlans(posts, noStockProfiles)
    expect(getChosenPlan(postBundle, new Map())).toBeNull()
  })

  it('returns null (not a crash) if the user explicitly picks a stock length that this bundle cannot fit', () => {
    const pieces = [makePiece({ id: 'b-long', lengthAxisMm: 6500 })] // fits 7000mm, not 6000mm
    const [longBundle] = buildProfileBundlePlans(pieces, profiles, 0)
    const plan = getChosenPlan(longBundle, new Map([[longBundle.bundleKey, 6000]]))
    expect(plan).toBeNull()
  })
})

describe('buildOrderSheetTotals', () => {
  const profiles: Map<string, ProfileDimensions> = new Map([
    ['f10040', { widthMm: 40, heightMm: 100, availableStockLengthsMm: [6000], weightKgPerMeter: 1.8 }],
    ['f4020', { widthMm: 40, heightMm: 20, availableStockLengthsMm: [6000] }], // no weight
  ])

  it('sums bars across color bundles of the SAME profile', () => {
    const anthracite = [makePiece({ id: 'b1', lengthAxisMm: 4000, profileId: 'f10040', color: '#2B2B2B' })]
    const white = [makePiece({ id: 'b2', lengthAxisMm: 4000, profileId: 'f10040', color: '#FFFFFF' })]
    const plans = buildProfileBundlePlans([...anthracite, ...white], profiles)

    const totals = buildOrderSheetTotals(plans, new Map())
    expect(totals).toHaveLength(1)
    expect(totals[0].profileId).toBe('f10040')
    expect(totals[0].totalBars).toBe(2) // one bar per color bundle, one piece each
  })

  it('computes total weight = bars × stockLength(m) × weightKgPerMeter when weight is known', () => {
    const pieces = [makePiece({ id: 'b1', lengthAxisMm: 4000, profileId: 'f10040' })]
    const plans = buildProfileBundlePlans(pieces, profiles)
    const totals = buildOrderSheetTotals(plans, new Map())

    // 1 bar of 6000mm = 6m × 1.8 kg/m = 10.8 kg
    expect(totals[0].totalWeightKg).toBeCloseTo(10.8, 5)
  })

  it('total weight is null (not a partial number) once ANY bundle of the profile lacks weightKgPerMeter', () => {
    // Same profileId "f4020" used by two color bundles is impossible in this catalog
    // (f4020 has no weight at all) — assert the missing-weight profile is null outright,
    // and that a DIFFERENT profile with full weight data is unaffected.
    const noWeightPieces = [makePiece({ id: 'l1', lengthAxisMm: 1200, profileId: 'f4020', role: 'lamella' })]
    const withWeightPieces = [makePiece({ id: 'b1', lengthAxisMm: 4000, profileId: 'f10040' })]
    const plans = buildProfileBundlePlans([...noWeightPieces, ...withWeightPieces], profiles)
    const totals = buildOrderSheetTotals(plans, new Map())

    const f4020Total = totals.find((t) => t.profileId === 'f4020')!
    const f10040Total = totals.find((t) => t.profileId === 'f10040')!
    expect(f4020Total.totalWeightKg).toBeNull()
    expect(f10040Total.totalWeightKg).not.toBeNull()
  })

  it('a profile is null overall if ONE of its two color bundles lacks a resolvable plan (no stock options)', () => {
    const noStockCatalog: Map<string, ProfileDimensions> = new Map([
      ['f10040', { widthMm: 40, heightMm: 100, availableStockLengthsMm: [6000], weightKgPerMeter: 1.8 }],
    ])
    const anthracite = [makePiece({ id: 'b1', lengthAxisMm: 4000, profileId: 'f10040', color: '#2B2B2B' })]
    // Same profileId but a color the catalog "somehow" has no stock data for is not a real
    // scenario (availableStockLengthsMm is per-profile, not per-color) — instead exercise
    // the analogous case directly via buildOrderSheetTotals with a hand-built bundle list.
    const plans = buildProfileBundlePlans(anthracite, noStockCatalog)
    plans.push({
      bundleKey: 'f10040::#FFFFFF',
      profileId: 'f10040',
      color: '#FFFFFF',
      pieceCount: 1,
      totalLengthLongMm: 4000,
      profileWidthMm: 40,
      profileHeightMm: 100,
      weightKgPerMeter: 1.8,
      options: [],
      recommendedStockLengthMm: null,
    })

    const totals = buildOrderSheetTotals(plans, new Map())
    const f10040Total = totals.find((t) => t.profileId === 'f10040')!
    expect(f10040Total.totalWeightKg).toBeNull()
    // Bars from the resolvable bundle are still counted — only weight is withheld.
    expect(f10040Total.totalBars).toBeGreaterThan(0)
  })
})
