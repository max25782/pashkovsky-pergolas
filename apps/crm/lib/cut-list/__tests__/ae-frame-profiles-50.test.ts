import { describe, expect, it } from 'vitest'
import {
  ANGLE_30_PROFILE_ID,
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  PERGOLA_CONSTRUCTION_PROFILES,
  angleProfileDimensions,
  beamPlanWidthForDrawing,
  buildAngleCutPieces,
  buildLamellaSections,
  buildPiecesFromPlan,
  contourAxesMatchEnteredOuters,
  contourSideWidthMm,
  isAllowedWallBeamProfileId,
  outerDeltaMmOnContourSideVertexRule,
  rebuildContourForEnteredOuters,
  specFromPlan,
} from '@pashkovsky/pergola-core'
import { buildProfileBundlePlans, DEFAULT_KERF_MM } from '../order-sheet'
import { profilePhotoMatch } from '../cut-map'

const LIVE_L: [number, number][] = [
  [0, 0],
  [4000, 0],
  [4000, 3000],
  [11960, 3000],
  [11960, 6460],
  [0, 6460],
]
const MEASURED = [4000, 3000, 8000, 3500, 12000, 6500]
const PLAN_11204: [number, number][] = [
  [0, 0],
  [4068.4687027231466, 0],
  [5106.934332450832, 2553.0978158093785],
  [-6000.023638426626, 2553.09781580938],
  [-4324.502411119518, -3946.5830654311662],
  [-1096.0842946293496, -3946.5830654311662],
]

const FRAMES = [
  { id: 'pa1197', kgPerM: 4.326, wall: 4, l12: { stock: 7000, bars: 6, kg: 181.7 }, p11204: { stock: 7000, bars: 6, kg: 181.7 } },
  { id: 'hs012', kgPerM: 2.388, wall: 2, l12: { stock: 7000, bars: 6, kg: 100.3 }, p11204: { stock: 7500, bars: 5, kg: 89.5 } },
  { id: 'F20050', kgPerM: 4.248, wall: 3, l12: { stock: 7000, bars: 6, kg: 178.4 }, p11204: { stock: 7000, bars: 6, kg: 178.4 } },
] as const

const profiles = new Map(PERGOLA_CONSTRUCTION_PROFILES)
profiles.set(ANGLE_30_PROFILE_ID, angleProfileDimensions())

function build(contour: [number, number][], beamProfileId: string, extra: Record<string, unknown> = {}) {
  const params = {
    ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
    ...extra,
    beamProfileId,
    purlinProfileId: 'PA3022',
    postProfileId: 'F100100',
    wingShelfProfileId: 'F4060',
    wallProfileId: 'pa1162',
    colorHex: '#9aa0a6',
  }
  const input = { contour, wallEdgeIndices: [] as number[], params }
  const built = buildPiecesFromPlan(input, PERGOLA_CONSTRUCTION_PROFILES)
  const sections = buildLamellaSections(specFromPlan(input), PERGOLA_CONSTRUCTION_PROFILES)
  const angles = buildAngleCutPieces(sections, params.colorHex)
  const plans = buildProfileBundlePlans([...built.pieces, ...angles], profiles, DEFAULT_KERF_MM)
  return { params, built, sections, angles, plans }
}

function chosenOf(plans: ReturnType<typeof build>['plans'], profileId: string) {
  const bundle = plans.find((plan) => plan.profileId === profileId)
  const stock = bundle?.recommendedStockLengthMm
  const option = bundle?.options.find((item) => item.stockLengthMm === stock)
  return { bundle, stock, plan: option?.plan }
}

describe.each(FRAMES)('frame beam $id (50 mm in plan)', (frame) => {
  it('takes the smaller section side as the plan width, with the Panda weight', () => {
    expect(beamPlanWidthForDrawing(PERGOLA_CONSTRUCTION_PROFILES, frame.id).planWidthMm).toBe(50)
    const profile = PERGOLA_CONSTRUCTION_PROFILES.get(frame.id)
    expect(profile?.planWidthSource).toBe('rule-min')
    expect(profile?.weightKgPerMeter).toBe(frame.kgPerM)
    expect(profile?.wallThicknessMm).toBe(frame.wall)
  })

  it('shows the section drawing in the cutting header and the order', () => {
    const match = profilePhotoMatch(frame.id)
    expect(match.file).toBe(`${frame.id.toLowerCase()}.jpg`)
    expect(match.confidence).toBe('high')
  })

  it('L 12 m: entered size is the distance between outer faces on every side', () => {
    const contour = rebuildContourForEnteredOuters({
      contour: LIVE_L,
      measuredOuterLengthMmByEdgeIndex: MEASURED,
      defaultBeamPlanWidthMm: 50,
    }) as [number, number][]
    expect(contour).not.toBeNull()
    expect(contourAxesMatchEnteredOuters({
      contour,
      measuredOuterLengthMmByEdgeIndex: MEASURED,
      defaultBeamPlanWidthMm: 50,
    })).toBe('match')
    for (let i = 0; i < contour.length; i++) {
      const a = contour[i]
      const b = contour[(i + 1) % contour.length]
      const axis = Math.hypot(b[0] - a[0], b[1] - a[1])
      expect(axis + outerDeltaMmOnContourSideVertexRule(contour, i, 50)).toBeCloseTo(MEASURED[i], 1)
    }
  })

  it('L 12 m: chain, purlins, sections, angle p1034, cutting and weight', () => {
    const contour = rebuildContourForEnteredOuters({
      contour: LIVE_L,
      measuredOuterLengthMmByEdgeIndex: MEASURED,
      defaultBeamPlanWidthMm: 50,
    }) as [number, number][]
    const { built, sections, angles, plans } = build(contour, frame.id, {
      measuredOuterLengthMmByEdgeIndex: MEASURED,
      purlinMaxSpanMm: 4000,
      lamellaDirectionDeg: 0,
      lamellaSectionLayoutVersion: 1,
      purlinClearLayoutVersion: 1,
    })
    expect(built.pieces.filter((piece) => piece.role === 'beam').every((piece) => piece.profileId === frame.id)).toBe(true)
    expect(built.pieces.filter((piece) => piece.role === 'purlin')).toHaveLength(11)
    // 13 before: the upper bay at the shelf / frame step also had a 40 mm wide
    // sliver (37 lamellas 40 mm long) beside a 1246.7 cell, 3400 vs 3405 clear.
    // They are one bay of 1286.7 (clear 3400), so 12 sections and 2 angles each.
    expect(sections).toHaveLength(12)
    expect(angles).toHaveLength(24)
    const beam = chosenOf(plans, frame.id)
    expect(beam.stock).toBe(frame.l12.stock)
    expect(beam.plan?.totalBars).toBe(frame.l12.bars)
    expect(Number((beam.plan!.totalBars * beam.stock! / 1000 * frame.kgPerM).toFixed(1))).toBe(frame.l12.kg)
    const angle = chosenOf(plans, 'p1034')
    expect(angle.stock).toBe(6000)
    // An angle is as long as its section height (about 3400): 26 -> 24 pieces
    // (the sliver had its own pair), 23 -> 21 bars of 6000.
    expect(angle.plan?.totalBars).toBe(21)
  })

  it('11204: cutting, order stock with the least waste, angle p1034 and weight', () => {
    const { built, sections, angles, plans } = build(PLAN_11204, frame.id)
    expect(built.pieces.filter((piece) => piece.role === 'beam').every((piece) => piece.profileId === frame.id)).toBe(true)
    expect(sections).toHaveLength(20)
    expect(angles).toHaveLength(40)
    const beam = chosenOf(plans, frame.id)
    expect(beam.stock).toBe(frame.p11204.stock)
    expect(beam.plan?.totalBars).toBe(frame.p11204.bars)
    expect(Number((beam.plan!.totalBars * beam.stock! / 1000 * frame.kgPerM).toFixed(1))).toBe(frame.p11204.kg)
    const waste = (beam.bundle?.options ?? []).flatMap((option) => (option.plan ? [option.plan.totalWasteMm] : []))
    expect(beam.plan!.totalWasteMm).toBe(Math.min(...waste))
    const angle = chosenOf(plans, 'p1034')
    expect(angle.stock).toBe(6000)
    expect(angle.plan?.totalBars).toBe(14)
    expect(plans.every((plan) => plan.weightKgPerMeter != null)).toBe(true)
  })

  it('is not a wall-side profile: a wall keeps 40 mm and a stray id falls back to f10040', () => {
    const wallInput = (wallProfileId: string) => ({
      wallEdgeIndices: [4, 5],
      beamProfileId: 'pa1429',
      wallProfileId,
      wallBeamWidthVersion: 1 as const,
    })
    // The perimeter beam can be this frame (50 wide); the wall list cannot.
    expect(isAllowedWallBeamProfileId(frame.id)).toBe(false)
    // Width comes from the selected allowed wall profile, not from the frame.
    expect(contourSideWidthMm(PERGOLA_CONSTRUCTION_PROFILES, 4, wallInput('f10040'))).toBe(40)
    expect(contourSideWidthMm(PERGOLA_CONSTRUCTION_PROFILES, 4, wallInput('pa1162'))).toBe(40)
    // A stored plan that names this frame as wall resolves to f10040 (40 mm).
    expect(contourSideWidthMm(PERGOLA_CONSTRUCTION_PROFILES, 4, wallInput(frame.id))).toBe(40)
    // The free beam stays 70 mm.
    expect(contourSideWidthMm(PERGOLA_CONSTRUCTION_PROFILES, 0, wallInput('f10040'))).toBe(70)
    const params = {
      ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      beamProfileId: frame.id,
      wallProfileId: 'f10040',
      wallBeamWidthVersion: 1 as const,
    }
    const built = buildPiecesFromPlan({ contour: LIVE_L, wallEdgeIndices: [4, 5], params }, PERGOLA_CONSTRUCTION_PROFILES)
    expect(built.pieces.some((piece) => piece.role === 'beam' && piece.profileId === frame.id)).toBe(true)
    expect(built.pieces.some((piece) => piece.role === 'beam' && piece.profileId === 'f10040')).toBe(true)
  })
})
