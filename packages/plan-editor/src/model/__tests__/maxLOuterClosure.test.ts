import { describe, expect, it } from 'vitest'
import {
  beamPlanWidthForDrawing,
  buildOuterAxisClosureReport,
  buildPlanEditorOverlayModel,
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  PERGOLA_CONSTRUCTION_PROFILES,
} from '@pashkovsky/pergola-core'
import { createPlanEditorStore } from '../store'
import { closureGap } from '../../geometry/closure'
import { toPolygon } from '../../geometry/chain'
import type { DraftEdge, FixedEdge } from '../../geometry/types'
import { commitOuterLengthMm } from '../../view-html/commitOuterLength'

const OUTER_MM = [5000, 3500, 9000, 7500, 4000, 4000]
const DIRS_DEG = [0, 90, 180, 270, 0, 90]

function draft(from: DraftEdge['from'], to: DraftEdge['to'], angleDeg: number): DraftEdge {
  return { from, to, dir: { angleDeg, snapped: true, snapAngle: angleDeg } }
}

function buildClosedLWithDirs(store: ReturnType<typeof createPlanEditorStore>) {
  let anchor = store.getState().startPoint
  for (let i = 0; i < DIRS_DEG.length - 1; i++) {
    const rad = (DIRS_DEG[i] * Math.PI) / 180
    const to = {
      x: anchor.x + 500 * Math.cos(rad),
      y: anchor.y + 500 * Math.sin(rad),
    }
    store.getState().setDraftEdge(draft(anchor, to, DIRS_DEG[i]))
    store.getState().commitDraft()
    anchor = store.getState().currentAnchor()
  }
  store.getState().setDraftEdge({
    from: anchor,
    to: store.getState().startPoint,
    dir: { angleDeg: DIRS_DEG[5], snapped: true, snapAngle: DIRS_DEG[5] },
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

describe('Max L midot — outer panel closes axis contour', () => {
  it('diagnostic: vertex deltas explain closure (w=40)', () => {
    const report = buildOuterAxisClosureReport({
      outerLengthsMm: OUTER_MM,
      angleDeg: DIRS_DEG,
      defaultBeamPlanWidthMm: 40,
    })
    expect(report.kinematicOuterGapMm).toBeLessThan(1)
    expect(report.axisClosureGapMm).toBeLessThan(0.01)
    expect(report.vertices.some((v) => v.kind === 'concave')).toBe(true)
    for (const e of report.edges) {
      expect(e.outerDeltaMm).toBeGreaterThanOrEqual(-40)
      expect(e.outerDeltaMm).toBeLessThanOrEqual(80)
    }
  })

  const beamPlanWidthMm = beamPlanWidthForDrawing(
    PERGOLA_CONSTRUCTION_PROFILES,
    DEFAULT_PLAN_CONSTRUCTION_PARAMS.beamProfileId,
  ).planWidthMm

  it('after all six outer inputs: closure 0, drawing sides match input (±1 mm)', () => {
    const store = createPlanEditorStore()
    buildClosedLWithDirs(store)
    const applyOuterLengths = store.getState().applyOuterLengths

    for (let i = 0; i < OUTER_MM.length; i++) {
      const id = store.getState().fixedEdges[i].id
      commitOuterLengthMm(OUTER_MM[i], id, {
        overlayForFixedEdges,
        getFixedEdges: () => store.getState().fixedEdges,
        applyOuterLengths: (outers, idx) => applyOuterLengths(outers, idx, beamPlanWidthMm),
      })
    }

    const gap = closureGap(store.getState().fixedEdges).distMm
    expect(gap).toBeLessThan(0.05)

    const overlay = overlayForFixedEdges(store.getState().fixedEdges)!
    for (let i = 0; i < OUTER_MM.length; i++) {
      expect(Math.abs(overlay.sides[i].outerLengthMm - OUTER_MM[i])).toBeLessThanOrEqual(1)
      expect(store.getState().fixedEdges[i].measuredOuterLengthMm).toBe(OUTER_MM[i])
    }
  })

  it('adjustAndClose on aligned contour does not change measured outer lengths', () => {
    const store = createPlanEditorStore()
    buildClosedLWithDirs(store)
    const applyOuterLengths = store.getState().applyOuterLengths
    for (let i = 0; i < OUTER_MM.length; i++) {
      const id = store.getState().fixedEdges[i].id
      commitOuterLengthMm(OUTER_MM[i], id, {
        overlayForFixedEdges,
        getFixedEdges: () => store.getState().fixedEdges,
        applyOuterLengths: (outers, idx) => applyOuterLengths(outers, idx, beamPlanWidthMm),
      })
    }
    const before = store.getState().fixedEdges.map((e) => ({
      lengthMm: e.lengthMm,
      measuredOuterLengthMm: e.measuredOuterLengthMm,
      angleDeg: e.angleDeg,
    }))
    store.getState().adjustAndClose()
    const after = store.getState().fixedEdges
    for (let i = 0; i < after.length; i++) {
      expect(after[i].lengthMm).toBeCloseTo(before[i].lengthMm, 2)
      expect(after[i].measuredOuterLengthMm).toBe(before[i].measuredOuterLengthMm)
      expect(after[i].angleDeg).toBeCloseTo(before[i].angleDeg, 2)
    }
  })
})
