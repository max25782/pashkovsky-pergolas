import { describe, expect, it } from 'vitest'
import { createPlanEditorStore } from '../store'
import { closureGap } from '../../geometry/closure'
import { toPolygon } from '../../geometry/chain'

const HOUSE = [
  { x: 0, y: 0 },
  { x: 9495, y: 0 },
  { x: 9495, y: 7480 },
  { x: 6745, y: 7480 },
  { x: 6745, y: 4615 },
  { x: 3280, y: 4609 },
  { x: 3280, y: 7480 },
  { x: 0, y: 7480 },
]

describe('acceptance house contour in the plan editor', () => {
  it('hydrates without a closure warning (gap ≤ 10 mm)', () => {
    const store = createPlanEditorStore()
    store.getState().hydrateContour(HOUSE, [2, 3, 4, 5])
    const gap = closureGap(store.getState().fixedEdges)
    expect(gap.distMm).toBeLessThanOrEqual(10)
    expect(store.getState().isClosed).toBe(true)
  })

  it('G-H 328→340 cm commits via updateEdgeLength (Enter/blur), then rebuilds', () => {
    const store = createPlanEditorStore()
    store.getState().hydrateContour(HOUSE, [2, 3, 4, 5])
    const gh = store.getState().fixedEdges[6]
    expect(gh.lengthMm).toBeCloseTo(3280, 3)
    store.getState().updateEdgeLength(gh.id, 3400)
    store.getState().adjustAndClose()
    const after = store.getState()
    expect(after.fixedEdges[6].lengthMm).toBeCloseTo(3400, 1)
    expect(closureGap(after.fixedEdges).distMm).toBeLessThanOrEqual(10)
    expect(toPolygon(after.fixedEdges)).toHaveLength(8)
  })
})
