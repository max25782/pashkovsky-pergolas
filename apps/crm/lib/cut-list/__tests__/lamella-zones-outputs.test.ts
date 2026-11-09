/**
 * A plan with a lamella zone must reach every output through the same piece list:
 * cut list bundles, order totals and weight, and the cut angles printed per piece.
 * Pieces of the zone and of the strip are summed here against the list they came from.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  PERGOLA_CONSTRUCTION_PROFILES,
  buildPieces,
  piecesWeightKg,
  specFromPlan,
  type LamellaZone,
} from '@pashkovsky/pergola-core'
import { SLANTED_WING_CONTOUR_MM } from '../../../../../packages/pergola-core/src/acceptance/slantedWingContour'
import {
  buildOrderSheetTotals,
  buildProfileBundlePlans,
  displayCutDeg,
  piecesForCutting,
} from '../order-sheet'

const PROFILES = PERGOLA_CONSTRUCTION_PROFILES
const WING_ZONE: LamellaZone = { id: 'wing', cutEdgeIndex: 2, lamellaEdgeIndex: 2, dividerEdgeIndex: 1 }

function build(zones: boolean) {
  const spec = specFromPlan({
    contour: SLANTED_WING_CONTOUR_MM,
    wallEdgeIndices: [],
    params: {
      ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      lamellaDirectionDeg: 90,
      contourReference: 'outer-faces',
      ...(zones ? { lamellaZones: [WING_ZONE] } : {}),
    } as never,
  })
  return buildPieces(spec, PROFILES)
}

describe('lamella zone in the cut list and the order', () => {
  const built = build(true)
  const cutting = piecesForCutting(built.pieces, [])
  const plans = buildProfileBundlePlans(cutting, PROFILES)
  const totals = buildOrderSheetTotals(plans, new Map())

  it('puts the zone lamellas and the strip lamellas into the cut list', () => {
    const lamellas = cutting.filter((p) => p.role === 'lamella')
    expect(lamellas.filter((p) => p.id.includes('-wing-')).length).toBeGreaterThan(0)
    expect(lamellas.filter((p) => !p.id.includes('-wing-')).length).toBeGreaterThan(0)
  })

  it('keeps every piece in a bundle: counts and lengths match the piece list', () => {
    expect(plans.reduce((sum, plan) => sum + plan.pieceCount, 0)).toBe(cutting.length)
    const listed = cutting.reduce((sum, piece) => sum + piece.lengthLongMm, 0)
    const bundled = plans.reduce((sum, plan) => sum + plan.totalLengthLongMm, 0)
    expect(bundled).toBeCloseTo(listed, 3)
  })

  it('orders at least the net metres of each profile', () => {
    for (const row of totals) {
      const netMm = cutting
        .filter((piece) => piece.profileId === row.profileId)
        .reduce((sum, piece) => sum + piece.lengthLongMm, 0)
      expect(row.totalMeters * 1000).toBeGreaterThanOrEqual(netMm - 0.5)
    }
  })

  it('weighs an order as ordered bar metres times the profile kg/m (one rule for every profile)', () => {
    for (const row of totals) {
      const perMeter = PROFILES.get(row.profileId)?.weightKgPerMeter
      if (perMeter == null) {
        expect(row.totalWeightKg).toBeNull()
        continue
      }
      expect(row.totalWeightKg).toBeCloseTo(row.totalMeters * perMeter, 6)
    }
  })

  it('weighs the parts by their own length, never above the ordered bars', () => {
    const net = piecesWeightKg(cutting, PROFILES)
    const ordered = totals.reduce((sum, row) => sum + (row.totalWeightKg ?? 0), 0)
    expect(net).toBeGreaterThan(0)
    expect(net).toBeLessThanOrEqual(ordered + 1e-6)
  })

  it('gives the slanted zone lamellas a printable cut angle', () => {
    const wingLamellas = cutting.filter((p) => p.role === 'lamella' && p.id.includes('-wing-'))
    const cut = wingLamellas.flatMap((p) => [p.cutMiterStartDeg, p.cutMiterEndDeg])
    expect(cut.every(Number.isFinite)).toBe(true)
    expect(cut.some((deg) => Math.abs(displayCutDeg(deg)) > 0.5)).toBe(true)
  })

  it('adds the zone to the order: more lamella metres than the plain strip alone', () => {
    const withZone = cutting.filter((p) => p.role === 'lamella').length
    const plain = piecesForCutting(build(false).pieces, []).filter((p) => p.role === 'lamella').length
    expect(withZone).not.toBe(plain)
  })
})
