import { describe, expect, it } from 'vitest'
import {
  ANGLE_30_PROFILE_ID,
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  LEGACY_DOUBLE_T_120_ID,
  PERGOLA_CONSTRUCTION_PROFILES,
  PERGOLA_PLAN_SCHEMA_VERSION,
  angleProfileDimensions,
  beamPlanWidthForDrawing,
  buildPiecesFromPlan,
  isRetiredProfileId,
} from '@pashkovsky/pergola-core'
import { parsePergolaPlan } from '../../pergolas/normalize-pergola'
import { buildProfileBundlePlans, DEFAULT_KERF_MM } from '../order-sheet'

const CONTOUR: [number, number][] = [[0, 0], [6000, 0], [6000, 4000], [0, 4000]]
const POLYGON = CONTOUR.map(([x, y]) => ({ x, y }))

const profiles = new Map(PERGOLA_CONSTRUCTION_PROFILES)
profiles.set(ANGLE_30_PROFILE_ID, angleProfileDimensions())

function planParams(beamProfileId: string) {
  return {
    ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
    beamProfileId,
    purlinProfileId: 'PA3022',
    wingShelfProfileId: 'F4060',
    postProfileId: 'F100100',
    wallProfileId: 'pa1162',
  }
}

describe('old profile ids are read, not rewritten in the database', () => {
  it('f12040 reads as pa1162 for the beam, the wall and the shelf', () => {
    const plan = parsePergolaPlan({
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon: POLYGON,
      wallIndices: [0],
      params: { beamProfileId: 'f12040', wallBeamWidthVersion: 1, wallProfileId: 'f12040', wingShelfProfileId: 'f12040' },
      confirmed: true,
    })
    expect(plan?.params.beamProfileId).toBe('pa1162')
    expect(plan?.params.wallProfileId).toBe('pa1162')
    expect(plan?.params.wingShelfProfileId).toBe('pa1162')
  })

  it('a plan with the raw id f12040 still builds and cuts as pa1162', () => {
    const raw = buildPiecesFromPlan({ contour: CONTOUR, wallEdgeIndices: [], params: planParams('f12040') }, profiles)
    const canonical = buildPiecesFromPlan({ contour: CONTOUR, wallEdgeIndices: [], params: planParams('pa1162') }, profiles)
    expect(raw.pieces).toHaveLength(canonical.pieces.length)
    expect(profiles.get('f12040')).toBe(profiles.get('pa1162'))
    expect(beamPlanWidthForDrawing(profiles, 'f12040').planWidthMm).toBe(40)
  })
})

describe('legacy double-T 120 (ישן)', () => {
  const profile = PERGOLA_CONSTRUCTION_PROFILES.get(LEGACY_DOUBLE_T_120_ID)

  it('is marked legacy and is not bound to PA268 or R242', () => {
    expect(isRetiredProfileId(LEGACY_DOUBLE_T_120_ID)).toBe(true)
    expect(profile?.deprecated).toBe(true)
    expect(profile?.labelHe).toContain('ישן')
    expect(profile?.sku).toBeUndefined()
    expect(profile?.weightKgPerMeter).toBeUndefined()
    expect(profile).not.toBe(PERGOLA_CONSTRUCTION_PROFILES.get('PA268 דאבל טי מעוצב 120'))
    expect(profile).not.toBe(PERGOLA_CONSTRUCTION_PROFILES.get('R242'))
    expect(beamPlanWidthForDrawing(PERGOLA_CONSTRUCTION_PROFILES, LEGACY_DOUBLE_T_120_ID).planWidthMm).toBe(70)
  })

  it('an old plan opens and produces cutting bundles', () => {
    const built = buildPiecesFromPlan({ contour: CONTOUR, wallEdgeIndices: [], params: planParams(LEGACY_DOUBLE_T_120_ID) }, profiles)
    const beams = built.pieces.filter((piece) => piece.role === 'beam')
    expect(beams).toHaveLength(4)
    expect(beams.every((piece) => piece.profileId === LEGACY_DOUBLE_T_120_ID)).toBe(true)
    const plans = buildProfileBundlePlans(built.pieces, profiles, DEFAULT_KERF_MM)
    const bundle = plans.find((plan) => plan.profileId === LEGACY_DOUBLE_T_120_ID)
    expect(bundle).toBeDefined()
    expect(bundle?.recommendedStockLengthMm).toBeGreaterThan(0)
  })

  it('the id is kept when the plan is parsed', () => {
    const plan = parsePergolaPlan({
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon: POLYGON,
      wallIndices: [],
      params: { beamProfileId: LEGACY_DOUBLE_T_120_ID },
      confirmed: true,
    })
    expect(plan?.params.beamProfileId).toBe(LEGACY_DOUBLE_T_120_ID)
  })
})
