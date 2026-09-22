import { isSimplePolygon, PERGOLA_PLAN_SCHEMA_VERSION, type PlanConstructionParams } from '@pashkovsky/pergola-core'
import type { Pergola, PergolaPlanPointMm } from '@/types/offer'

export interface PlanGeometryInput {
  polygon: PergolaPlanPointMm[]
  wallIndices: number[]
  params: PlanConstructionParams
  isClosed: boolean
  isSimple: boolean
}

function polygonsEqual(a: PergolaPlanPointMm[] | undefined, b: PergolaPlanPointMm[]): boolean {
  if (!a || a.length !== b.length) return false
  return a.every((point, index) => {
    const other = b[index]
    return Math.abs(point.x - other.x) < 0.05 && Math.abs(point.y - other.y) < 0.05
  })
}

function sameNumbers(a: number[] | undefined, b: number[]): boolean {
  if (!a || a.length !== b.length) return false
  return a.every((value, index) => value === b[index])
}

/**
 * Merge a live plan-editor contour into a pergola.
 * Polygon edits clear `confirmed`. Type, price, and location stay on `prev`.
 * An open contour does not replace a stored polygon.
 */
export function applyPlanGeometry(prev: Pergola, geometry: PlanGeometryInput): Pergola {
  const closed =
    geometry.isClosed &&
    geometry.isSimple &&
    geometry.polygon.length >= 3 &&
    isSimplePolygon(geometry.polygon)
  if (!closed) return prev

  const samePolygon = polygonsEqual(prev.plan?.polygon, geometry.polygon)
  const sameWalls = sameNumbers(prev.plan?.wallIndices, geometry.wallIndices)
  const sameParams =
    prev.plan != null && JSON.stringify(prev.plan.params) === JSON.stringify(geometry.params)
  if (samePolygon && sameWalls && sameParams) return prev

  return {
    ...prev,
    plan: {
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon: geometry.polygon,
      wallIndices: geometry.wallIndices,
      params: geometry.params,
      confirmed: samePolygon && prev.plan?.confirmed === true,
    },
  }
}
