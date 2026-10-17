import type { LamellaAngleDeg, SupportType } from './types'

/** Current JSON schema for `Pergola.plan` stored in `pergolas_data`. */
export const PERGOLA_PLAN_SCHEMA_VERSION = 1

export interface PlanConstructionParams {
  lamellaPatternId: string
  lamellaGapMm: number
  lamellaDirectionDeg: number
  lamellaOnEdge: boolean
  beamProfileId: string
  purlinProfileId: string
  postProfileId: string
  visturMode: boolean
  heightMm: number
  lamellaAngleDeg: LamellaAngleDeg
  /** `#RRGGBB`, `RAL7016`, or `wood` / `wood:oak`. */
  colorHex: string
  supportType: Exclude<SupportType, 'posts'>
}

export const DEFAULT_PLAN_CONSTRUCTION_PARAMS: PlanConstructionParams = {
  lamellaPatternId: 'all-70',
  lamellaGapMm: 20,
  lamellaDirectionDeg: 0,
  lamellaOnEdge: false,
  visturMode: false,
  beamProfileId: 'f10040',
  purlinProfileId: 'purlin-led-6040',
  postProfileId: 'f8080',
  heightMm: 2600,
  lamellaAngleDeg: 0,
  colorHex: '#9aa0a6',
  supportType: 'free-standing',
}
