import { computeFrame, type ProfileDimensions } from '@pashkovsky/pergola-core'

const PROFILES: Map<string, ProfileDimensions> = new Map([
  ['f8080', { widthMm: 80, heightMm: 80, availableStockLengthsMm: [6000] }],
  ['f10040', { widthMm: 40, heightMm: 100, maxSpanMm: 5000, availableStockLengthsMm: [6000] }],
  ['f7020', { widthMm: 70, heightMm: 20, maxLamellaSpanMm: 1500, availableStockLengthsMm: [6000] }],
])

function isContourOrthogonal(polygon: Array<{ x: number; y: number }>): boolean {
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
  return computeFrame(spec, PROFILES).isOrthogonal
}

describe('plan orthogonality flag', () => {
  it('marks a trapezoid as non-orthogonal', () => {
    const trapezoid = [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 3500, y: 3000 },
      { x: 500, y: 3000 },
    ]
    expect(isContourOrthogonal(trapezoid)).toBe(false)
  })

  it('marks an axis-aligned rectangle as orthogonal', () => {
    const rect = [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 6000 },
      { x: 0, y: 6000 },
    ]
    expect(isContourOrthogonal(rect)).toBe(true)
  })
})
