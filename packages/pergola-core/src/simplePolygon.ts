export interface PlanPointMm {
  x: number
  y: number
}

const EPS = 1e-6

function orientation(a: PlanPointMm, b: PlanPointMm, c: PlanPointMm): number {
  const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  if (Math.abs(cross) < EPS) return 0
  return cross > 0 ? 1 : -1
}

function onSegment(a: PlanPointMm, b: PlanPointMm, p: PlanPointMm): boolean {
  return (
    Math.min(a.x, b.x) - EPS <= p.x &&
    p.x <= Math.max(a.x, b.x) + EPS &&
    Math.min(a.y, b.y) - EPS <= p.y &&
    p.y <= Math.max(a.y, b.y) + EPS
  )
}

function segmentsIntersect(a1: PlanPointMm, a2: PlanPointMm, b1: PlanPointMm, b2: PlanPointMm): boolean {
  const o1 = orientation(a1, a2, b1)
  const o2 = orientation(a1, a2, b2)
  const o3 = orientation(b1, b2, a1)
  const o4 = orientation(b1, b2, a2)

  if (o1 !== o2 && o3 !== o4) return true

  if (o1 === 0 && onSegment(a1, a2, b1)) return true
  if (o2 === 0 && onSegment(a1, a2, b2)) return true
  if (o3 === 0 && onSegment(b1, b2, a1)) return true
  if (o4 === 0 && onSegment(b1, b2, a2)) return true

  return false
}

/** True when the closed polygon has no self-intersections among non-adjacent edges. */
export function isSimplePolygon(points: PlanPointMm[]): boolean {
  const n = points.length
  if (n < 3) return true

  for (let i = 0; i < n; i++) {
    const a1 = points[i]
    const a2 = points[(i + 1) % n]
    for (let j = i + 1; j < n; j++) {
      const isAdjacent = j === i + 1 || (i === 0 && j === n - 1)
      if (isAdjacent) continue
      const b1 = points[j]
      const b2 = points[(j + 1) % n]
      if (segmentsIntersect(a1, a2, b1, b2)) return false
    }
  }
  return true
}
