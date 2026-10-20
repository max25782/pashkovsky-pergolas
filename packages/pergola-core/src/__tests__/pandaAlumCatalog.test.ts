import { describe, expect, it } from 'vitest'
import { DEFAULT_PLAN_CONSTRUCTION_PARAMS } from '../planDefaults'
import { resolveLamellaPatternIds } from '../lamellaPresets'
import {
  applyLamellaWallThickness,
  CONSTRUCTION_BEAM_IDS,
  CONSTRUCTION_POST_IDS,
  CONSTRUCTION_PURLIN_IDS,
  formatConstructionProfileLabel,
  LAMELLA_70_08_ID,
  LAMELLA_70_16_ID,
  parseLamellaWallThicknessMm,
  PERGOLA_CONSTRUCTION_PROFILES,
} from '../pergolaProfiles'
import {
  findPandaAlumBySku,
  PANDA_ALUM_CATALOG_URL,
  PANDA_ALUM_PROFILES,
  parseCatalogNameDims,
  pergolaCatalogSlot,
} from '../supplier/pandaAlum'
import { specFromPlan } from '../buildPieces'

describe('panda-alum catalog', () => {
  it('loads the scraped supplier profiles', () => {
    expect(PANDA_ALUM_CATALOG_URL).toBe('https://www.panda-alum.co.il/profile-calculator/')
    expect(PANDA_ALUM_PROFILES.length).toBeGreaterThanOrEqual(198)
  })

  it('maps construction 70×20 to supplier f7020 at 0.8 mm / 0.411 kg/m', () => {
    const row = findPandaAlumBySku('f7020')
    expect(row?.nameHe).toBe('מלבן 20/70/0.8')
    expect(row?.wallThicknessMm).toBe(0.8)
    expect(row?.weightKgPerM).toBe(0.411)

    const profile = PERGOLA_CONSTRUCTION_PROFILES.get(LAMELLA_70_08_ID)
    expect(profile?.wallThicknessMm).toBe(0.8)
    expect(profile?.weightKgPerMeter).toBe(0.411)
    expect(profile?.labelHe).toBe('מלבן 20/70/0.8')
  })

  it('uses marked pa 1121 for 70×20 / 1.6 mm', () => {
    expect(findPandaAlumBySku('pa 1121')?.wallThicknessMm).toBe(1.6)
    const thicker = PERGOLA_CONSTRUCTION_PROFILES.get(LAMELLA_70_16_ID)
    expect(thicker?.wallThicknessMm).toBe(1.6)
    expect(thicker?.weightKgPerMeter).toBe(0.89)
    expect(thicker?.labelHe).toBe('מלבן 20/70/1.6')
  })

  it('reads Hebrew pergola slots from categoryHe', () => {
    expect(pergolaCatalogSlot('lamella לפרגולה')).toBe('lamella')
    expect(pergolaCatalogSlot('עמוד פרגולה')).toBe('post')
    expect(pergolaCatalogSlot('מסגרת לפרגולה')).toBe('beam')
    expect(pergolaCatalogSlot('חוצץ/אגד לפרגולה')).toBe('purlin')
    expect(pergolaCatalogSlot('חוצץ/אגד לפרגולה עם מקום לתאורה')).toBe('purlin-led')
    expect(pergolaCatalogSlot('מילוי פרגולה/גדר/שער')).toBeNull()
  })

  it('parses name sizes without inventing a missing width', () => {
    expect(parseCatalogNameDims('מלבן 20/70/0.8', 'lamella')).toEqual({
      widthMm: 70, heightMm: 20, widthAssumed: false,
    })
    expect(parseCatalogNameDims('מלבן 40/120/1.8', 'beam')).toEqual({
      widthMm: 40, heightMm: 120, widthAssumed: false,
    })
    expect(parseCatalogNameDims('מרובע 100/100/2', 'post')).toEqual({
      widthMm: 100, heightMm: 100, widthAssumed: false,
    })
    expect(parseCatalogNameDims('טי תאורה 120/40', 'purlin-led')).toEqual({
      widthMm: 40, heightMm: 120, widthAssumed: false,
    })
    expect(parseCatalogNameDims('טי 100 (חוצץ לפרגולה)', 'purlin')?.widthAssumed).toBe(true)
    expect(parseCatalogNameDims('דאבל טי 120', 'beam')).toEqual({
      widthMm: 70, heightMm: 120, widthAssumed: false,
    })
    expect(parseCatalogNameDims('דאבל טי 142/1.6', 'beam')).toEqual({
      widthMm: 70, heightMm: 142, widthAssumed: false,
    })
    expect(parseCatalogNameDims('דאבל טי מעוצב (הייטק) 120', 'beam')).toEqual({
      widthMm: 70, heightMm: 120, widthAssumed: false,
    })
  })

  it('mounts marked double-T beams 70 wide × web tall', () => {
    const t142 = PERGOLA_CONSTRUCTION_PROFILES.get('R242')
    expect(t142?.widthMm).toBe(70)
    expect(t142?.heightMm).toBe(142)
    const t120 = PERGOLA_CONSTRUCTION_PROFILES.get('PA268 דאבל טי מעוצב 120')
    expect(t120?.widthMm).toBe(70)
    expect(t120?.heightMm).toBe(120)
  })

  it('puts marked catalog rows on the construction dropdowns', () => {
    expect(CONSTRUCTION_BEAM_IDS).toContain('pa1162')
    expect(CONSTRUCTION_POST_IDS).toContain('F100100')
    expect(CONSTRUCTION_POST_IDS).toContain('pa2015')
    expect(CONSTRUCTION_PURLIN_IDS).toContain('PA3022')
    expect(CONSTRUCTION_PURLIN_IDS).toContain('HS001')
  })
})

describe('70×20 wall thickness', () => {
  it('defaults to 0.8 and keeps f7020', () => {
    expect(DEFAULT_PLAN_CONSTRUCTION_PARAMS.lamellaWallThicknessMm).toBe(0.8)
    expect(resolveLamellaPatternIds('all-70')).toEqual([LAMELLA_70_08_ID])
    expect(parseLamellaWallThicknessMm(undefined)).toBeUndefined()
  })

  it('remaps only 70×20 ids when thickness is 1.6', () => {
    expect(resolveLamellaPatternIds('all-70', 1.6)).toEqual([LAMELLA_70_16_ID])
    expect(resolveLamellaPatternIds('mixed-70-40-20', 1.6)).toEqual([LAMELLA_70_16_ID, 'f4020', 'f2020'])
    expect(applyLamellaWallThickness('f4020', 1.6)).toBe('f4020')
    expect(parseLamellaWallThicknessMm(1)).toBe(1.6)
  })

  it('specFromPlan uses the remapped 70×20 id', () => {
    const contour: [number, number][] = [[0, 0], [4000, 0], [4000, 3000], [0, 3000]]
    const thin = specFromPlan({
      contour,
      wallEdgeIndices: [],
      params: DEFAULT_PLAN_CONSTRUCTION_PARAMS,
    })
    expect(thin.lamellaPattern).toEqual([LAMELLA_70_08_ID])

    const thick = specFromPlan({
      contour,
      wallEdgeIndices: [],
      params: { ...DEFAULT_PLAN_CONSTRUCTION_PARAMS, lamellaWallThicknessMm: 1.6 },
    })
    expect(thick.lamellaPattern).toEqual([LAMELLA_70_16_ID])
    expect(thick.lamellaProfileId).toBe(LAMELLA_70_16_ID)
  })

  it('labels construction profiles with the supplier name', () => {
    expect(formatConstructionProfileLabel('f7020')).toContain('מלבן 20/70/0.8')
    expect(formatConstructionProfileLabel('f10040')).toContain('מלבן 40/100/1.8')
    expect(formatConstructionProfileLabel('F100100')).toContain('מרובע 100/100/2')
  })
})
