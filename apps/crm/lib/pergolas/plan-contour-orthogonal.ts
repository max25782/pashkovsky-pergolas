import { computeFrame, type ProfileDimensions } from '@pashkovsky/pergola-core'

const PLAN_ORTHOGONAL_PROFILES: Map<string, ProfileDimensions> = new Map([
  ['f8080', { widthMm: 80, heightMm: 80, availableStockLengthsMm: [6000] }],
  ['f10040', { widthMm: 40, heightMm: 100, maxSpanMm: 5000, availableStockLengthsMm: [6000] }],
  ['f7020', { widthMm: 70, heightMm: 20, maxLamellaSpanMm: 1500, availableStockLengthsMm: [6000] }],
])

/** Same orthogonality signal as quick-offer UI (`PlanGeometryChange.isOrthogonal`). */
export function isPlanContourOrthogonal(polygon: Array<{ x: number; y: number }>): boolean {
  if (polygon.length < 3) return true
  const spec = {
    contour: polygon.map((p) => [p.x, p.y] as [number, number]),
    heightMm: 2600,
    lamellaGapMm: 20,
    lamellaAngleDeg: 0,
    lamellaDirectionDeg: 0,
    lamellaOnEdge: false,
    postProfileId: 'f8080',
    beamProfileId: 'f10040',
    lamellaProfileId: 'f7020',
    lamellaPattern: ['f7020'],
    wallEdgeIndices: [],
    color: '#9aa0a6',
  }
  return computeFrame(spec, PLAN_ORTHOGONAL_PROFILES).isOrthogonal
}
