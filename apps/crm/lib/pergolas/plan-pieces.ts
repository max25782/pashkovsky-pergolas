import type { BuiltPieces, SupportBeamsDocument } from '@pashkovsky/pergola-core'
import {
  buildPiecesFromPlan as buildPiecesFromPlanCore,
  PERGOLA_CONSTRUCTION_PROFILES,
  type PlanConstructionParams,
} from '@pashkovsky/pergola-core'

export const PLAN_PREVIEW_PROFILES = PERGOLA_CONSTRUCTION_PROFILES

export function buildPiecesFromPlan(input: {
  polygon: Array<{ x: number; y: number }>
  wallIndices: number[]
  params: PlanConstructionParams
  supportBeams?: SupportBeamsDocument
}): BuiltPieces {
  return buildPiecesFromPlanCore(
    {
      contour: input.polygon.map((p): [number, number] => [p.x, p.y]),
      wallEdgeIndices: input.wallIndices,
      params: input.params,
      ...(input.supportBeams ? { supportBeams: input.supportBeams } : {}),
    },
    PLAN_PREVIEW_PROFILES,
  )
}
