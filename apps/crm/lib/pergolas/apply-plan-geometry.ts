import {
  isSimplePolygon,
  mergePergolaPlanDocument,
  pickPergolaPlanExtras,
  pinContourReferenceOnParams,
  type PlanConstructionParams,
  type Point2D,
  type SupportBeamsDocument,
} from '@pashkovsky/pergola-core'
import type { Pergola, PergolaPlan, PergolaPlanPointMm } from '@/types/offer'

export interface PlanGeometryInput {
  polygon: PergolaPlanPointMm[]
  wallIndices: number[]
  params: PlanConstructionParams
  isClosed: boolean
  isSimple: boolean
  /**
   * When set (including `null` to clear), replaces stored beams.
   * When omitted, previous `supportBeams` and unknown top-level keys are kept.
   */
  supportBeams?: SupportBeamsDocument | unknown | null
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

function sameBeams(
  a: PergolaPlan['supportBeams'] | undefined,
  b: SupportBeamsDocument | unknown | null | undefined,
): boolean {
  if (b === undefined) return true
  if (b === null) return a === undefined
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Merge a live plan-editor contour into a pergola.
 * Polygon edits clear `confirmed`. Type, price, and location stay on `prev`.
 * An open contour does not replace a stored polygon.
 * Unknown top-level plan keys and `supportBeams` survive unless explicitly patched.
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
  const beamsUnchanged = sameBeams(prev.plan?.supportBeams, geometry.supportBeams)
  if (samePolygon && sameWalls && sameParams && beamsUnchanged) return prev

  const extras = pickPergolaPlanExtras(prev.plan as Record<string, unknown> | null | undefined)
  const contour: Point2D[] = geometry.polygon.map((p) => [p.x, p.y])
  const prevParams = prev.plan?.params
  // When measured is newly invented on this write, pin from the prior state so
  // equal-to-edge measured cannot flip centerline → outer-faces.
  const pinSource =
    !geometry.params.contourReference
    && prevParams
    && !prevParams.contourReference
    && geometry.params.measuredOuterLengthMmByEdgeIndex
    && !prevParams.measuredOuterLengthMmByEdgeIndex
      ? { ...geometry.params, measuredOuterLengthMmByEdgeIndex: prevParams.measuredOuterLengthMmByEdgeIndex }
      : geometry.params
  const params = {
    ...geometry.params,
    contourReference: pinContourReferenceOnParams(contour, pinSource).contourReference,
  }
  const doc = mergePergolaPlanDocument({
    extras,
    polygon: geometry.polygon,
    wallIndices: geometry.wallIndices,
    params,
    confirmed: samePolygon && prev.plan?.confirmed === true,
    supportBeams: geometry.supportBeams,
    prevSupportBeams: prev.plan?.supportBeams,
  })

  return {
    ...prev,
    plan: doc as unknown as PergolaPlan,
  }
}
