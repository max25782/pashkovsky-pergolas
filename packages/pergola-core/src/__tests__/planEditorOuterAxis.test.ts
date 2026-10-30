import { describe, expect, it } from 'vitest'
import { buildOuterAxisClosureReport, isConcaveVertexCCW } from '../planEditorOuterAxis'

/** Max L midot example (mm): A→B 5000 … F→G 4000 @ cardinal angles. */
const MAX_L_MIDOT_OUTER_MM = [5000, 3500, 9000, 7500, 4000, 4000]
const MAX_L_DIRS_DEG = [0, 90, 180, 270, 0, 90]

describe('planEditorOuterAxis — Max L midot closure', () => {
  it('kinematic outer input closes; axis chain closes with w=40', () => {
    const report = buildOuterAxisClosureReport({
      outerLengthsMm: MAX_L_MIDOT_OUTER_MM,
      angleDeg: MAX_L_DIRS_DEG,
      defaultBeamPlanWidthMm: 40,
    })
    expect(report.kinematicOuterGapMm).toBeLessThan(1)
    expect(report.axisClosureGapMm).toBeLessThan(0.01)
    expect(report.vertices.some((v) => v.kind === 'concave')).toBe(true)
    for (const e of report.edges) {
      expect(e.outerLengthMm - e.axisLengthMm).toBeCloseTo(e.outerDeltaMm, 3)
    }
  })

  it('rectangle outer 4000 mm subtracts beam width — never adds', () => {
    const report = buildOuterAxisClosureReport({
      outerLengthsMm: [4000, 3000, 4000, 3000],
      angleDeg: [0, 90, 180, 270],
      defaultBeamPlanWidthMm: 40,
    })
    expect(isConcaveVertexCCW([0, 1000], [0, 0], [1000, 0])).toBe(false)
    for (const e of report.edges) {
      expect(e.outerDeltaMm).toBeGreaterThan(0)
      expect(e.axisLengthMm).toBeLessThan(e.outerLengthMm)
      expect(e.axisLengthMm).toBeCloseTo(e.outerLengthMm - e.outerDeltaMm, 3)
    }
    expect(report.edges[0].outerLengthMm).toBe(4000)
    expect(report.edges[0].axisLengthMm).toBe(3960)
  })

  it('mixed beam plan widths 80 / 70 still close axis chain', () => {
    const planWidthForEdge = (i: number) => (i % 2 === 0 ? 80 : 70)
    const report = buildOuterAxisClosureReport({
      outerLengthsMm: MAX_L_MIDOT_OUTER_MM,
      angleDeg: MAX_L_DIRS_DEG,
      defaultBeamPlanWidthMm: 40,
      planWidthForEdge,
    })
    expect(report.kinematicOuterGapMm).toBeLessThan(1)
    expect(report.axisClosureGapMm).toBeLessThan(0.01)
  })
})
