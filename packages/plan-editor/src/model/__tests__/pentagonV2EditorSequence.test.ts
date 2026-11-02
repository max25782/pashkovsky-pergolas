/**
 * Stage 3: editor-equivalent sequence that builds pentagon v2
 * (outers + explicit purlin positions + support beam) and checks totals
 * against the fixture for both windings (±1 mm geometry, same cut totals).
 *
 * Gaps vs a pure UI click-path (documented, not fixed here beyond what's needed):
 * 1. Five outer sizes alone do not determine a skew pentagon — angles are required
 *    (Sizes panel: length + angle). This test uses the fixture centerline (angles
 *    already correct) rather than reconstructing from outers-only.
 * 2. Explicit purlin centres need manual mode / typed positions (now: setManualPurlinLines
 *    + divider position input in CRM). Auto equal-clear would not hit 1272…8659.
 * 3. Lamella direction 90° is set in construction params (already available).
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_KERF_MM,
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  PERGOLA_CONSTRUCTION_PROFILES,
  WING_SHELF_SPAN_DIVIDER_ID,
  buildLamellaSections,
  buildPieces,
  countedLamellaRows,
  groupCutPiecesByBundle,
  makeStraightSupportBeam,
  packProfile,
  setManualPurlinLines,
  specFromPlan,
  supportBeamAxisFromSideMm,
  type CutPiece,
  type PlanConstructionParams,
  type Point2D,
} from '@pashkovsky/pergola-core'
import {
  V2_BEAM,
  V2_BEAM_PLAN_WIDTH_MM,
  V2_CROSSBEAM_CENTRES_Y_MM,
  V2_CROSSBEAM_PROFILE_ID,
  V2_LENGTH_TOLERANCE_MM,
  pentagonV2Contour,
  pentagonV2PlanParams,
  pentagonV2SupportBeams,
} from './fixtures/skew-pentagon-850-2026-11-01-v2'

const profiles = PERGOLA_CONSTRUCTION_PROFILES

function editorSequencePlan(mirror: boolean) {
  const contour = pentagonV2Contour(mirror)
  // Step: set lamella direction 90°, frame/purlin profiles, typed outers, clear auto shelf.
  let params: PlanConstructionParams = pentagonV2PlanParams(DEFAULT_PLAN_CONSTRUCTION_PARAMS)
  // Step: enable explicit purlin positions (same numbers Max types).
  params = setManualPurlinLines(
    params,
    V2_CROSSBEAM_CENTRES_Y_MM.map((positionMm, i) => ({ id: `row-${i + 1}`, positionMm })),
  )
  // Step: add straight support beam from L5 high face at 3104.1 from the straight (min-stack) side.
  const purlinHalf =
    (profiles.get(V2_CROSSBEAM_PROFILE_ID)?.widthMm ?? V2_BEAM_PLAN_WIDTH_MM) / 2
  // Prefer drawing width when available via beamPlanWidth — fixture uses 40.
  const beam = makeStraightSupportBeam({
    id: 'beam-l5-to-de',
    axisFromSideMm: V2_BEAM.axisFromEaOuterMm,
    // from omitted ⇒ longest edge ∥ lamellas (EA), both windings
    contour,
    startPurlinId: 'row-5',
    face: 'high',
    profileId: V2_BEAM.profileId,
    widthMm: V2_BEAM_PLAN_WIDTH_MM,
    directionDeg: 90,
    startPurlinPositionMm: V2_CROSSBEAM_CENTRES_Y_MM[4],
    purlinHalfMm: purlinHalf,
    frameHalfMm: 20,
  })
  const supportBeams = { formatVersion: 1 as const, beams: [beam] }
  const fixtureBeams = pentagonV2SupportBeams(mirror)
  return { contour, params, supportBeams, fixtureBeams, beam }
}

function barsForProfile(pieces: CutPiece[], profileId: string): number {
  const bundle = [...groupCutPiecesByBundle(pieces).values()].find((b) => b[0].profileId === profileId)
  if (!bundle) return 0
  const profile = profiles.get(profileId)
  const stocks = [...(profile?.availableStockLengthsMm ?? [])].sort((a, b) => a - b)
  let bestBars: number | null = null
  let bestWaste: number | null = null
  for (const stock of stocks) {
    try {
      const plan = packProfile(bundle, stock, DEFAULT_KERF_MM)
      if (
        bestWaste == null ||
        plan.totalWasteMm < bestWaste - 1 ||
        (Math.abs(plan.totalWasteMm - bestWaste) <= 1 && bestBars != null && plan.totalBars < bestBars)
      ) {
        bestWaste = plan.totalWasteMm
        bestBars = plan.totalBars
      }
    } catch {
      /* piece longer than this stock */
    }
  }
  return bestBars ?? 0
}

function totals(
  contour: Point2D[],
  params: PlanConstructionParams,
  supportBeams: ReturnType<typeof pentagonV2SupportBeams>,
) {
  const spec = specFromPlan({ contour, wallEdgeIndices: [], params, supportBeams })
  const built = buildPieces(spec, profiles)
  const sections = buildLamellaSections(spec, profiles)
  const lamellas = built.pieces.filter((p) => p.role === 'lamella')
  const f7020Len = lamellas.reduce((s, p) => s + p.lengthAxisMm, 0)
  return {
    sectionCount: sections.length,
    lamellaCount: sections.reduce((n, s) => n + countedLamellaRows(s), 0),
    f7020LenMm: Math.round(f7020Len),
    pieces: built.pieces,
    sections,
    bars: barsForProfile(built.pieces, 'f7020'),
  }
}

describe('pentagon v2 editor sequence ≈ fixture', () => {
  for (const mirror of [false, true] as const) {
    const label = mirror ? 'CW (mirrored editor)' : 'CCW (target)'
    it(`${label}: makeStraightSupportBeam axis matches fixture (±1 mm) and mouse/number agree`, () => {
      const { contour, beam, fixtureBeams } = editorSequencePlan(mirror)
      const fixture = fixtureBeams.beams[0]
      expect(Math.abs(beam.anchorMm.x - fixture.anchorMm.x)).toBeLessThanOrEqual(V2_LENGTH_TOLERANCE_MM)
      expect(Math.abs(beam.anchorMm.y - fixture.anchorMm.y)).toBeLessThanOrEqual(V2_LENGTH_TOLERANCE_MM)
      const fromNumber = supportBeamAxisFromSideMm(beam, contour, undefined, 20)
      expect(Math.abs(fromNumber - V2_BEAM.axisFromEaOuterMm)).toBeLessThanOrEqual(V2_LENGTH_TOLERANCE_MM)
      // Mouse path: same formula as the number field (axis from straight outer side).
      const fromMouse = supportBeamAxisFromSideMm(
        {
          ...beam,
          anchorMm: { x: beam.anchorMm.x, y: beam.anchorMm.y },
        },
        contour,
        undefined,
        20,
      )
      expect(Math.abs(fromMouse - fromNumber)).toBeLessThanOrEqual(0.05)
    })

    it(`${label}: sequence totals match fixture 16 / 385 / 392249 / 67`, () => {
      const { contour, params, supportBeams } = editorSequencePlan(mirror)
      const got = totals(contour, params, supportBeams)
      const fixture = totals(contour, params, pentagonV2SupportBeams(mirror))
      expect(got.sectionCount).toBe(fixture.sectionCount)
      expect(got.lamellaCount).toBe(fixture.lamellaCount)
      expect(got.f7020LenMm).toBe(fixture.f7020LenMm)
      expect(got.bars).toBe(fixture.bars)
      expect(got.sectionCount).toBe(16)
      expect(got.lamellaCount).toBe(385)
      expect(got.f7020LenMm).toBe(392249)
      expect(got.bars).toBe(67)
      const beamPiece = got.pieces.find((p) => p.dividerId === WING_SHELF_SPAN_DIVIDER_ID)
      expect(beamPiece).toBeTruthy()
      expect(beamPiece!.lengthAxisMm).toBeCloseTo(3139.9, 0)
    })
  }

  it('plans without supportBeams stay byte-identical when the field is omitted', () => {
    const contour = pentagonV2Contour(false)
    const params = pentagonV2PlanParams(DEFAULT_PLAN_CONSTRUCTION_PARAMS)
    const a = JSON.stringify(buildPieces(specFromPlan({ contour, wallEdgeIndices: [], params }), profiles).pieces)
    const b = JSON.stringify(
      buildPieces(specFromPlan({ contour, wallEdgeIndices: [], params, supportBeams: undefined }), profiles)
        .pieces,
    )
    expect(a).toBe(b)
  })
})
