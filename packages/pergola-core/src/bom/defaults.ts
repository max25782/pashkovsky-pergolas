import { BOM_PROFILE_CATALOG } from './catalog'
import type { FastenerRule, NestSettings } from './types'

export const DEFAULT_KERF_CM = 0.3
export const DEFAULT_STOCK_LENGTH_CM = 600
export const DEFAULT_MIN_REUSABLE_OFFCUT_CM = 100
export const DEFAULT_MIN_REMAINDER_CM = 100
export const DEFAULT_SPARE_PCT = 5
export const DEFAULT_ANGLE_SPACING_CM = 40
export const DEFAULT_SHADE_BEARING_FRAMES = 2
export const DEFAULT_SCREWS_PER_DIVISION_END = 2
export const DEFAULT_SCREWS_PER_FRAME_CORNER = 4
export const DEFAULT_SCREWS_PER_HANGER = 3
export const DEFAULT_HANGER_COUNT = 4
export const DEFAULT_FRAME_CORNERS = 4

export const DEFAULT_NEST_SETTINGS: NestSettings = {
  kerfCm: DEFAULT_KERF_CM,
  minReusableOffcutCm: DEFAULT_MIN_REUSABLE_OFFCUT_CM,
  minRemainderCm: DEFAULT_MIN_REMAINDER_CM,
  frameMethod: 'plain_plus_angle',
  frameSplit: 'economical',
  hiddenAngles: 'whole',
  defaultStockLengthCm: DEFAULT_STOCK_LENGTH_CM,
  catalog: BOM_PROFILE_CATALOG,
}

export function mergeNestSettings(partial?: Partial<NestSettings>): NestSettings {
  return {
    ...DEFAULT_NEST_SETTINGS,
    ...partial,
    catalog: partial?.catalog ?? DEFAULT_NEST_SETTINGS.catalog,
  }
}

export const DEFAULT_FASTENER_RULES: FastenerRule[] = [
  {
    id: 'shade_screws',
    name: 'Винты крепления затенения',
    kind: 'shade_screws',
    sparePct: DEFAULT_SPARE_PCT,
    unit: 'шт',
    shadeBearingFrameCount: DEFAULT_SHADE_BEARING_FRAMES,
  },
  {
    id: 'construction_screws',
    name: 'Винты конструкции',
    kind: 'construction_screws',
    sparePct: DEFAULT_SPARE_PCT,
    unit: 'шт',
    screwsPerDivisionEnd: DEFAULT_SCREWS_PER_DIVISION_END,
    screwsPerFrameCorner: DEFAULT_SCREWS_PER_FRAME_CORNER,
    screwsPerHanger: DEFAULT_SCREWS_PER_HANGER,
  },
  {
    id: 'angle_screws',
    name: 'Винты для уголков',
    kind: 'angle_screws',
    sparePct: DEFAULT_SPARE_PCT,
    unit: 'шт',
    spacingCm: DEFAULT_ANGLE_SPACING_CM,
    includeEnds: true,
  },
]
