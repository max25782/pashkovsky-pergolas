export type { PieceWarning } from '../types'
export type {
  AluminumLine,
  BomCatalog,
  BomModel,
  BomPart,
  BomPrices,
  BomProfile,
  BomResult,
  FastenerKind,
  FastenerLine,
  FastenerRule,
  FrameMethod,
  FrameSplit,
  HiddenAngles,
  NestedBar,
  NestCut,
  NestResult,
  NestSettings,
  PartKind,
} from './types'

export { BOM_PROFILE_CATALOG, resolveProfile, stockLengthCm } from './catalog'
export {
  DEFAULT_ANGLE_SPACING_CM,
  DEFAULT_FASTENER_RULES,
  DEFAULT_FRAME_CORNERS,
  DEFAULT_HANGER_COUNT,
  DEFAULT_KERF_CM,
  DEFAULT_MIN_REMAINDER_CM,
  DEFAULT_MIN_REUSABLE_OFFCUT_CM,
  DEFAULT_NEST_SETTINGS,
  DEFAULT_SCREWS_PER_DIVISION_END,
  DEFAULT_SCREWS_PER_FRAME_CORNER,
  DEFAULT_SCREWS_PER_HANGER,
  DEFAULT_SHADE_BEARING_FRAMES,
  DEFAULT_SPARE_PCT,
  DEFAULT_STOCK_LENGTH_CM,
  mergeNestSettings,
} from './defaults'
export { buildParts, nestLengthCm } from './buildParts'
export { barUsedCm, nest, splitForStock } from './nest'
export { fasteners } from './fasteners'
export { buildBom } from './buildBom'
