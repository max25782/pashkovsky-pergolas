// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import {
  buildPieces,
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  PERGOLA_CONSTRUCTION_PROFILES,
  specFromPlan,
} from '@pashkovsky/pergola-core'
import type { Point2D } from '@pashkovsky/pergola-core'
import { TopPlanSheet } from '../TopPlanSheet'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub)

/**
 * The sheet paints a wall beam darker (data-wall-beam). Wall indices count the plan's
 * own edges, beam ids count the frame's counter-clockwise copy. The same plan drawn
 * clockwise or counter-clockwise must paint the same beams as walls.
 */
const params = {
  ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  beamProfileId: 'pa1429',
  wallProfileId: 'f10040',
  wallBeamWidthVersion: 1 as const,
  lamellaDirectionDeg: 0,
  purlinMaxSpanMm: 4000,
  purlinClearLayoutVersion: 1 as const,
}

function paintedWalls(contour: Point2D[], walls: number[]): string[] {
  const spec = specFromPlan({ contour, wallEdgeIndices: walls, params })
  const built = buildPieces(spec, PERGOLA_CONSTRUCTION_PROFILES)
  const { container } = render(
    <TopPlanSheet
      pieces={built.pieces}
      profiles={PERGOLA_CONSTRUCTION_PROFILES}
      planContour={contour}
      constructionParams={params}
      wallEdgeIndices={walls}
    />,
  )
  const polygons = Array.from(container.querySelectorAll('polygon[data-wall-beam="1"]'))
  return polygons.map((p) => p.getAttribute('points') ?? '').sort()
}

const reversedWalls = (n: number, walls: number[]) => walls.map((k) => (2 * n - 2 - k) % n)

describe('TopPlanSheet wall beams', () => {
  const plans: Array<{ name: string; contour: Point2D[]; walls: number[] }> = [
    { name: 'rectangle, wall on the bottom side', contour: [[0, 0], [6000, 0], [6000, 4000], [0, 4000]], walls: [0] },
    { name: 'rectangle, wall on the right side', contour: [[0, 0], [6000, 0], [6000, 4000], [0, 4000]], walls: [1] },
    {
      name: 'skew pentagon, wall on the slanted side',
      contour: [[20, 20], [889.81, 20], [5877.298, 6884.61], [6269.409, 9124.567], [20, 9786.769]],
      walls: [1],
    },
  ]

  for (const plan of plans) {
    it(`${plan.name}: clockwise paints the same wall beams as counter-clockwise`, () => {
      const n = plan.contour.length
      const ccw = paintedWalls(plan.contour, plan.walls)
      const cw = paintedWalls([...plan.contour].reverse(), reversedWalls(n, plan.walls))
      expect(ccw.length).toBeGreaterThan(0)
      expect(cw).toEqual(ccw)
    })
  }
})
