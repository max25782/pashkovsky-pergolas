import { describe, expect, it } from 'vitest'
import {
  beamPlanWidthForDrawing,
  buildPlanEditorOverlayModel,
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  PERGOLA_CONSTRUCTION_PROFILES,
} from '@pashkovsky/pergola-core'
import { createPlanEditorStore } from '../store'
import { toPolygon } from '../../geometry/chain'
import { closureGap } from '../../geometry/closure'
import type { DraftEdge, FixedEdge } from '../../geometry/types'
import { commitOuterLengthMm } from '../../view-html/commitOuterLength'
import { edgeDisplayLengthMm } from '../../view-html/edgeOuterLength'
import { buildConstructionContextValue } from '../constructionContext'

/** Midot panel cm@deg: 400@0, 300@90, 800@180, 600@270, 400@0, 300@90 */
const MIDOT_MM = [4000, 3000, 8000, 6000, 4000, 3000]
const MIDOT_DEG = [0, 90, 180, 270, 0, 90]
/** Drawing labels in contour order: shelf, right, top, left, bottom, notch vertical. */
const DRAWING_LABELS_MM = {
  shelf: 4000,
  right: 3000,
  top: 8000,
  left: 6000,
  bottom: 4000,
  notchVertical: 3000,
}

function draft(from: DraftEdge['from'], to: DraftEdge['to'], angleDeg: number): DraftEdge {
  return { from, to, dir: { angleDeg, snapped: true, snapAngle: angleDeg } }
}

function buildClosedMidotSkeleton(store: ReturnType<typeof createPlanEditorStore>) {
  let anchor = store.getState().startPoint
  for (let i = 0; i < MIDOT_DEG.length - 1; i++) {
    const rad = (MIDOT_DEG[i] * Math.PI) / 180
    const to = {
      x: anchor.x + 500 * Math.cos(rad),
      y: anchor.y + 500 * Math.sin(rad),
    }
    store.getState().setDraftEdge(draft(anchor, to, MIDOT_DEG[i]))
    store.getState().commitDraft()
    anchor = store.getState().currentAnchor()
  }
  store.getState().setDraftEdge({
    from: anchor,
    to: store.getState().startPoint,
    dir: { angleDeg: MIDOT_DEG[5], snapped: true, snapAngle: MIDOT_DEG[5] },
    closesContour: true,
  })
  store.getState().closeContour()
}

function overlayForFixedEdges(edges: FixedEdge[]) {
  const contour = toPolygon(edges).map((p) => [p.x, p.y] as [number, number])
  const measuredOuterLengthMmByEdgeId = new Map<string, number>()
  for (const edge of edges) {
    if (edge.measuredOuterLengthMm != null) {
      measuredOuterLengthMmByEdgeId.set(edge.id, edge.measuredOuterLengthMm)
    }
  }
  return buildPlanEditorOverlayModel({
    contour,
    wallEdgeIndices: [],
    params: { ...DEFAULT_PLAN_CONSTRUCTION_PARAMS },
    profiles: PERGOLA_CONSTRUCTION_PROFILES,
    edgeIds: edges.map((e) => e.id),
    contourClosureGapMm: closureGap(edges).distMm,
    measuredOuterLengthMmByEdgeId,
  })
}

const BEAM_PLAN_WIDTH_MM = beamPlanWidthForDrawing(
  PERGOLA_CONSTRUCTION_PROFILES,
  DEFAULT_PLAN_CONSTRUCTION_PARAMS.beamProfileId,
).planWidthMm

function commitAllMidot(store: ReturnType<typeof createPlanEditorStore>) {
  const applyOuterLengths = store.getState().applyOuterLengths
  for (let i = 0; i < MIDOT_MM.length; i++) {
    const id = store.getState().fixedEdges[i].id
    commitOuterLengthMm(MIDOT_MM[i], id, {
      overlayForFixedEdges,
      getFixedEdges: () => store.getState().fixedEdges,
      applyOuterLengths: (outers, idx) => applyOuterLengths(outers, idx, BEAM_PLAN_WIDTH_MM),
    })
  }
}

describe('midot acceptance — typed cm is the drawing label (0 mm tolerance)', () => {
  it('400@0, 300@90, 800@180, 600@270, 400@0, 300@90 → 4000/3000/8000/6000/4000/3000', () => {
    const store = createPlanEditorStore()
    buildClosedMidotSkeleton(store)
    expect(store.getState().fixedEdges).toHaveLength(6)
    commitAllMidot(store)

    const edges = store.getState().fixedEdges
    for (let i = 0; i < 6; i++) {
      expect(edges[i].measuredOuterLengthMm).toBe(MIDOT_MM[i])
    }

    const overlay = overlayForFixedEdges(edges)
    expect(overlay).not.toBeNull()
    const labels = overlay!.dimensionModel.perimeterChains.map((c) => c.segmentsMm[0])
    const fromPoints = overlay!.dimensionModel.perimeterChains.map(
      (c) => c.points[1].distanceFromStartMm - c.points[0].distanceFromStartMm,
    )
    expect(labels).toEqual(MIDOT_MM)
    expect(fromPoints).toEqual(MIDOT_MM)
    expect(overlay!.sides.map((s) => s.outerLengthMm)).toEqual(MIDOT_MM)

    expect(labels[0]).toBe(DRAWING_LABELS_MM.shelf)
    expect(labels[1]).toBe(DRAWING_LABELS_MM.right)
    expect(labels[2]).toBe(DRAWING_LABELS_MM.top)
    expect(labels[3]).toBe(DRAWING_LABELS_MM.left)
    expect(labels[4]).toBe(DRAWING_LABELS_MM.bottom)
    expect(labels[5]).toBe(DRAWING_LABELS_MM.notchVertical)

    const construction = buildConstructionContextValue(overlay!, overlayForFixedEdges, BEAM_PLAN_WIDTH_MM)
    for (let i = 0; i < 6; i++) {
      const panel = edgeDisplayLengthMm(edges[i], construction)
      expect(panel.displayLengthMm).toBe(MIDOT_MM[i])
    }

    expect(labels.some((n) => n === 8120 || n === 3120 || n === 4080 || n === 3080 || n === 4120)).toBe(
      false,
    )
  })
})
