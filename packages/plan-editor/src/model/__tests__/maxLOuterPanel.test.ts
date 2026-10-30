import { describe, expect, it } from 'vitest'
import {
  beamPlanWidthForDrawing,
  buildPlanEditorOverlayModel,
  buildPiecesFromPlan,
  outerLengthToAxisLengthMm,
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  PERGOLA_CONSTRUCTION_PROFILES,
} from '@pashkovsky/pergola-core'
import { createPlanEditorStore } from '../store'
import { toPolygon } from '../../geometry/chain'
import { closureGap } from '../../geometry/closure'
import type { DraftEdge, FixedEdge } from '../../geometry/types'
import { commitOuterLengthMm } from '../../view-html/commitOuterLength'

function draft(from: DraftEdge['from'], to: DraftEdge['to'], angleDeg: number): DraftEdge {
  return { from, to, dir: { angleDeg, snapped: true, snapAngle: angleDeg } }
}

/** Panel cm: A→B 450, B→C 350, C→D 900, D→E 700, E→F 450, F→G 350 */
const MAX_L_OUTER_MM = [4500, 3500, 9000, 7000, 4500, 3500]

// Headings close the L: x 4500 − 9000 + 4500 = 0, y 3500 − 7000 + 3500 = 0.
// The earlier [0, 90, 180, 90, 180, 270] ended 9000 mm short of the start, so the
// closing edge was a long diagonal. With the v1 purlin grid taken from the
// longest side parallel to the lamellas (3460..10460), the 3460 mm lamellas on
// the lower part had no purlin and the build rejected them. A closed L has the
// 7000 side spanning the whole bounding box and gets the full grid.
function buildRoughMaxLClosed(store: ReturnType<typeof createPlanEditorStore>) {
  const dirsDeg = [0, 90, 180, 270, 0, 90]
  let anchor = store.getState().startPoint
  for (let i = 0; i < 5; i++) {
    const rad = (dirsDeg[i] * Math.PI) / 180
    const to = {
      x: anchor.x + 500 * Math.cos(rad),
      y: anchor.y + 500 * Math.sin(rad),
    }
    store.getState().setDraftEdge(draft(anchor, to, dirsDeg[i]))
    store.getState().commitDraft()
    anchor = store.getState().currentAnchor()
  }
  store.getState().setDraftEdge({
    from: anchor,
    to: store.getState().startPoint,
    dir: { angleDeg: dirsDeg[5], snapped: true, snapAngle: dirsDeg[5] },
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

function overlayForStore(store: ReturnType<typeof createPlanEditorStore>) {
  return overlayForFixedEdges(store.getState().fixedEdges)
}

const BEAM_PLAN_WIDTH_MM = beamPlanWidthForDrawing(
  PERGOLA_CONSTRUCTION_PROFILES,
  DEFAULT_PLAN_CONSTRUCTION_PARAMS.beamProfileId,
).planWidthMm

function commitOuterOnStore(
  store: ReturnType<typeof createPlanEditorStore>,
  edgeIndex: number,
  outerMm: number,
) {
  const id = store.getState().fixedEdges[edgeIndex].id
  commitOuterLengthMm(outerMm, id, {
    overlayForFixedEdges,
    getFixedEdges: () => store.getState().fixedEdges,
    applyOuterLengths: (outers, idx) =>
      store.getState().applyOuterLengths(outers, idx, BEAM_PLAN_WIDTH_MM),
  })
}

describe('Max L — outer panel input matches drawing dimensions', () => {
  it('typed 4000 mm is the drawing label; axis is not longer', () => {
    const store = createPlanEditorStore()
    buildRoughMaxLClosed(store)
    commitOuterOnStore(store, 4, 4000)
    const edge = store.getState().fixedEdges[4]
    expect(edge.measuredOuterLengthMm).toBe(4000)
    expect(edge.lengthMm).toBeLessThanOrEqual(4000)
    const side = overlayForStore(store)!.sides[4]
    expect(side.outerLengthMm).toBe(4000)
    expect(side.axisLengthMm).toBeLessThanOrEqual(4000)
  })

  it('single side A→B 450 cm outer lands on drawing within 1 mm', () => {
    const store = createPlanEditorStore()
    buildRoughMaxLClosed(store)
    commitOuterOnStore(store, 0, 4500)
    const side = overlayForStore(store)!.sides[0]
    expect(Math.abs(side.outerLengthMm - 4500)).toBeLessThanOrEqual(1)
  })

  it('axis on A→B unchanged when B→C outer is committed; outer on drawing still 4500 mm', () => {
    const store = createPlanEditorStore()
    buildRoughMaxLClosed(store)
    commitOuterOnStore(store, 0, 4500)
    const before = overlayForStore(store)!.sides[0]
    commitOuterOnStore(store, 1, 3500)
    const after = overlayForStore(store)!.sides[0]
    expect(after.axisLengthMm).toBeCloseTo(before.axisLengthMm, 2)
    expect(Math.abs(after.outerLengthMm - 4500)).toBeLessThanOrEqual(1)
  })

  it('after entering 450/350/900/700 cm as outer lengths, each side matches drawing (±1 mm)', () => {
    const store = createPlanEditorStore()
    buildRoughMaxLClosed(store)
    expect(store.getState().fixedEdges).toHaveLength(6)

    const expectedFirstFour = [4500, 3500, 9000, 7000]
    for (let i = 0; i < expectedFirstFour.length; i++) {
      commitOuterOnStore(store, i, expectedFirstFour[i])
      const side = overlayForStore(store)!.sides[i]
      expect(Math.abs(side.outerLengthMm - expectedFirstFour[i])).toBeLessThanOrEqual(1)
    }
  })

  it('re-entering the same outer on side B→C does not accumulate (±1 mm)', () => {
    const store = createPlanEditorStore()
    buildRoughMaxLClosed(store)
    for (let i = 0; i < 4; i++) {
      commitOuterOnStore(store, i, MAX_L_OUTER_MM[i])
    }
    commitOuterOnStore(store, 1, 3500)
    const after = overlayForStore(store)!.sides[1].outerLengthMm
    expect(Math.abs(after - 3500)).toBeLessThanOrEqual(1)
  })
})

describe('Max L + PA3022 build (LED 7 073 094 mm regression)', () => {
  it('buildPiecesFromPlan succeeds after outer panel dimensions', () => {
    const store = createPlanEditorStore()
    buildRoughMaxLClosed(store)
    for (let i = 0; i < MAX_L_OUTER_MM.length; i++) {
      commitOuterOnStore(store, i, MAX_L_OUTER_MM[i])
    }
    const contour = toPolygon(store.getState().fixedEdges).map((p) => [p.x, p.y] as [number, number])
    const params = {
      ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      lamellaDirectionDeg: 90,
      purlinProfileId: 'PA3022',
    }
    expect(() =>
      buildPiecesFromPlan({ contour, wallEdgeIndices: [], params }, PERGOLA_CONSTRUCTION_PROFILES),
    ).not.toThrow()
  })
})
