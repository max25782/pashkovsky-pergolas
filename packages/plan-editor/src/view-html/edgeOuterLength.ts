import { outerLengthToAxisLengthMm } from '@pashkovsky/pergola-core'
import type { FixedEdge } from '../geometry/types'
import type { PlanEditorConstructionContextValue } from '../model/constructionContext'

export function edgeDisplayLengthMm(
  edge: FixedEdge,
  construction: PlanEditorConstructionContextValue | null,
): { displayLengthMm: number; outerDeltaMm: number | undefined; usesOuterLength: boolean } {
  const outerSide = construction?.overlay.sides.find((s) => s.edgeId === edge.id)
  const outerDeltaMm = outerSide?.outerDeltaMm ?? construction?.outerDeltaByEdgeId.get(edge.id)
  const displayLengthMm = edge.measuredOuterLengthMm ?? edge.lengthMm
  const usesOuterLength = outerDeltaMm != null && construction != null
  return { displayLengthMm, outerDeltaMm, usesOuterLength }
}

/** Panel / edge editor: user enters outer face length when construction overlay is active. */
export function axisLengthFromUserInputMm(
  enteredMm: number,
  outerDeltaMm: number | undefined,
  usesOuterLength: boolean,
): number {
  if (usesOuterLength && outerDeltaMm != null) {
    return outerLengthToAxisLengthMm(enteredMm, Math.max(0, outerDeltaMm))
  }
  return enteredMm
}
