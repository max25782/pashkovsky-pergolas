'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { PlanEditorOverlayModel } from '@pashkovsky/pergola-core'
import type { FixedEdge } from '../geometry/types'

export interface PlanEditorConstructionContextValue {
  overlay: PlanEditorOverlayModel
  outerLengthByEdgeId: Map<string, number>
  outerDeltaByEdgeId: Map<string, number>
  beamPlanWidthMm: number
  planWidthForEdge?: (edgeIndex: number) => number
  /** Same overlay builder as PlanEditor uses; needed for outer-length commit iteration. */
  overlayForFixedEdges: (edges: FixedEdge[]) => PlanEditorOverlayModel | null
}

const PlanEditorConstructionContext = createContext<PlanEditorConstructionContextValue | null>(null)

export function PlanEditorConstructionProvider({
  value,
  children,
}: {
  value: PlanEditorConstructionContextValue | null
  children: ReactNode
}) {
  return <PlanEditorConstructionContext.Provider value={value}>{children}</PlanEditorConstructionContext.Provider>
}

export function usePlanEditorConstruction(): PlanEditorConstructionContextValue | null {
  return useContext(PlanEditorConstructionContext)
}

export function buildConstructionContextValue(
  overlay: PlanEditorOverlayModel,
  overlayForFixedEdges: (edges: FixedEdge[]) => PlanEditorOverlayModel | null,
  beamPlanWidthMm: number,
  planWidthForEdge?: (edgeIndex: number) => number,
): PlanEditorConstructionContextValue {
  const outerLengthByEdgeId = new Map<string, number>()
  const outerDeltaByEdgeId = new Map<string, number>()
  for (const side of overlay.sides) {
    outerLengthByEdgeId.set(side.edgeId, side.outerLengthMm)
    outerDeltaByEdgeId.set(side.edgeId, side.outerDeltaMm)
  }
  return { overlay, outerLengthByEdgeId, outerDeltaByEdgeId, beamPlanWidthMm, planWidthForEdge, overlayForFixedEdges }
}
