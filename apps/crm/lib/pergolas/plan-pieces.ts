import type { CutPiece, Point2D, ProfileDimensions } from '@pashkovsky/pergola-core'
import {
  computeFrame,
  computeLamellas,
  segmentBeamsForStock,
  segmentLedPurlinsForStock,
  DEFAULT_KERF_MM,
  DEFAULT_VISTUR_TOLERANCES,
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

interface LamellaPatternPreset {
  id: string
  pattern: string[]
}

const LAMELLA_PATTERN_PRESETS: LamellaPatternPreset[] = [
  { id: 'all-20', pattern: ['f2020'] },
  { id: 'all-40', pattern: ['f4020'] },
  { id: 'all-70', pattern: ['f7020'] },
  { id: 'mixed-70-40', pattern: ['f7020', 'f4020'] },
  { id: 'mixed-70-40-20', pattern: ['f7020', 'f4020', 'f2020'] },
]

function getLamellaPatternPreset(id: string): LamellaPatternPreset {
  return LAMELLA_PATTERN_PRESETS.find((p) => p.id === id) ?? LAMELLA_PATTERN_PRESETS[0]
}

export function buildPiecesFromPlan(input: {
  polygon: Array<{ x: number; y: number }>
  wallIndices: number[]
  params: PlanConstructionParams
}): CutPiece[] {
  const params = input.params
  const pattern = getLamellaPatternPreset(params.lamellaPatternId).pattern
  const contour: Point2D[] = input.polygon.map((p): Point2D => [p.x, p.y])
  const spec = {
    contour,
    heightMm: 2600,
    lamellaGapMm: params.lamellaGapMm,
    lamellaAngleDeg: 0,
    lamellaDirectionDeg: params.lamellaDirectionDeg,
    lamellaOnEdge: params.lamellaOnEdge,
    postProfileId: params.postProfileId,
    beamProfileId: params.beamProfileId,
    lamellaProfileId: pattern[0],
    lamellaPattern: [...pattern],
    purlinProfileId: params.purlinProfileId || undefined,
    wallEdgeIndices: input.wallIndices,
    color: '#9aa0a6',
    visturTolerances: params.visturMode ? DEFAULT_VISTUR_TOLERANCES : undefined,
  }
  const frame = computeFrame(spec, PLAN_PREVIEW_PROFILES)
  const lamellas = computeLamellas(spec, PLAN_PREVIEW_PROFILES)
  const ledResult = segmentLedPurlinsForStock(spec, PLAN_PREVIEW_PROFILES, frame.posts, frame.beams, DEFAULT_KERF_MM)
  const purlins = [...ledResult.purlins, ...ledResult.dividers]
  const beamResult = segmentBeamsForStock(spec, frame, [...lamellas, ...purlins], PLAN_PREVIEW_PROFILES, DEFAULT_KERF_MM)
  return [...beamResult.beams, ...beamResult.posts, ...lamellas, ...purlins]
}
