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
}
