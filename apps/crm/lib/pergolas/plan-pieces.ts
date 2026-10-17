import type { CutPiece, ProfileDimensions } from '@pashkovsky/pergola-core'
import {
  buildPiecesFromPlan as buildPiecesFromPlanCore,
  type PlanConstructionParams,
} from '@pashkovsky/pergola-core'

export const PLAN_PREVIEW_PROFILES: Map<string, ProfileDimensions> = new Map([
  ['f8080', { widthMm: 80, heightMm: 80, availableStockLengthsMm: [4000, 6000] }],
  ['f6060', { widthMm: 60, heightMm: 60, availableStockLengthsMm: [4000, 6000] }],
  ['f10040', { widthMm: 40, heightMm: 100, maxSpanMm: 5000, availableStockLengthsMm: [6000, 7000] }],
  ['f12050', { widthMm: 50, heightMm: 120, maxSpanMm: 6000, availableStockLengthsMm: [6000, 7000, 8000] }],
  ['f2020', { widthMm: 20, heightMm: 20, maxLamellaSpanMm: 1500, availableStockLengthsMm: [6000] }],
  ['f4020', { widthMm: 40, heightMm: 20, maxLamellaSpanMm: 1500, availableStockLengthsMm: [6000] }],
  ['f7020', { widthMm: 70, heightMm: 20, maxLamellaSpanMm: 1500, availableStockLengthsMm: [6000] }],
  ['purlin-plain-5030', { widthMm: 30, heightMm: 50, maxSpanMm: 3000, interruptsLamella: false, availableStockLengthsMm: [6000] }],
  ['purlin-led-6040', { widthMm: 40, heightMm: 60, maxSpanMm: 3000, interruptsLamella: true, ledChannelWidthMm: 12, ledMaxStockLengthMm: 5000, availableStockLengthsMm: [6000] }],
])

export function buildPiecesFromPlan(input: {
  polygon: Array<{ x: number; y: number }>
  wallIndices: number[]
  params: PlanConstructionParams
}): CutPiece[] {
  return buildPiecesFromPlanCore(
    {
      contour: input.polygon.map((p): [number, number] => [p.x, p.y]),
      wallEdgeIndices: input.wallIndices,
      params: input.params,
    },
    PLAN_PREVIEW_PROFILES,
  ).pieces
}
