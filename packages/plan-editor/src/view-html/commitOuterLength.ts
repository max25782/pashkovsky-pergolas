import type { PlanEditorOverlayModel } from '@pashkovsky/pergola-core'
import type { FixedEdge } from '../geometry/types'

export interface OuterLengthCommitDeps {
  overlayForFixedEdges: (edges: FixedEdge[]) => PlanEditorOverlayModel | null
  getFixedEdges: () => FixedEdge[]
  applyOuterLengths: (outerLengthsMm: number[], updatedEdgeIndex: number) => void
}

function outerTargetMmForEdge(
  edge: FixedEdge,
  edgeIndex: number,
  targetOuterMm: number,
  targetEdgeId: string,
  overlay: PlanEditorOverlayModel | null,
): number {
  if (edge.id === targetEdgeId) return Math.round(targetOuterMm)
  if (edge.measuredOuterLengthMm != null) return edge.measuredOuterLengthMm
  const side = overlay?.sides.find((s) => s.edgeId === edge.id)
  if (side) return side.outerLengthMm
  return edge.lengthMm
}

/**
 * User enters outer face length; store rebuilds axis lengths from vertex ±w/2 rule.
 */
export function commitOuterLengthMm(targetOuterMm: number, edgeId: string, deps: OuterLengthCommitDeps): void {
  if (!Number.isFinite(targetOuterMm)) return

  const edges = deps.getFixedEdges()
  const edgeIndex = edges.findIndex((e) => e.id === edgeId)
  if (edgeIndex === -1) return

  const overlay = deps.overlayForFixedEdges(edges)
  const outerLengthsMm = edges.map((e, i) =>
    outerTargetMmForEdge(e, i, targetOuterMm, edgeId, overlay),
  )

  deps.applyOuterLengths(outerLengthsMm, edgeIndex)
}
