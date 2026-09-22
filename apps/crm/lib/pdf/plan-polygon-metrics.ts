export interface PlanPointMm {
  x: number
  y: number
}

export function planPolygonEdgeLengthsMm(polygon: PlanPointMm[]): number[] {
  if (polygon.length < 2) return []
  const lengths: number[] = []
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    const dx = b.x - a.x
    const dy = b.y - a.y
    lengths.push(Math.sqrt(dx * dx + dy * dy))
  }
  return lengths
}

/** Shoelace formula; input in mm, output in m² */
export function planPolygonAreaSqm(polygon: PlanPointMm[]): number {
  if (polygon.length < 3) return 0
  let sum = 0
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length
    sum += polygon[i].x * polygon[j].y - polygon[j].x * polygon[i].y
  }
  return Math.abs(sum) / 2 / 1_000_000
}
