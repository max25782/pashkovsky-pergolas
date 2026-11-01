// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import {
  buildPieces,
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  PERGOLA_CONSTRUCTION_PROFILES,
  specFromPlan,
} from '@pashkovsky/pergola-core'
import type { PlanConstructionParams, Point2D } from '@pashkovsky/pergola-core'
import { TopPlanSheet } from '../TopPlanSheet'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub)

/**
 * Per-edge plan fields read by the drawing sheet: typed outer sizes (by edge index),
 * walls and manual dividers. The same plan drawn clockwise or counter-clockwise must
 * print the same dimension labels.
 */
const baseParams: PlanConstructionParams = {
  ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  beamProfileId: 'pa1429',
  wallProfileId: 'f10040',
  wallBeamWidthVersion: 1,
  lamellaDirectionDeg: 0,
  purlinMaxSpanMm: 4000,
  purlinClearLayoutVersion: 1,
}

const swap = (k: number, n: number) => (2 * n - 2 - (((k % n) + n) % n)) % n

interface SheetLabel {
  text: string
  x: number
  y: number
}

/**
 * Labels are matched by text, and positions must agree within LABEL_SHIFT_PX. A value
 * printed on the wrong side lands hundreds of px away; the small residual shift is the
 * label-collision pass reacting to the corner-angle leaders, which move by up to ~27 px
 * between winding orders even on a plain rectangle with no per-edge fields (the perimeter
 * chain runs along the contour as drawn, so the collision pass sees reversed extension
 * lines). Cosmetic; same endpoints, same text.
 */
const LABEL_SHIFT_PX = 30

function expectSameLabels(cw: SheetLabel[], ccw: SheetLabel[]): void {
  expect(cw.map((l) => l.text)).toEqual(ccw.map((l) => l.text))
  cw.forEach((l, i) => {
    if (l.text.endsWith('°')) return
    expect(Math.abs(l.x - ccw[i].x), `x of "${l.text}"`).toBeLessThanOrEqual(LABEL_SHIFT_PX)
    expect(Math.abs(l.y - ccw[i].y), `y of "${l.text}"`).toBeLessThanOrEqual(LABEL_SHIFT_PX)
  })
}

function labels(contour: Point2D[], walls: number[], params: PlanConstructionParams): SheetLabel[] {
  const spec = specFromPlan({ contour, wallEdgeIndices: walls, params })
  const built = buildPieces(spec, PERGOLA_CONSTRUCTION_PROFILES)
  const { container, unmount } = render(
    <TopPlanSheet
      pieces={built.pieces}
      profiles={PERGOLA_CONSTRUCTION_PROFILES}
      planContour={contour}
      constructionParams={params}
      wallEdgeIndices={walls}
    />,
  )
  const out: SheetLabel[] = Array.from(container.querySelectorAll('text'))
    .map((t) => ({ text: (t.textContent ?? '').trim(), x: Number(t.getAttribute('x')), y: Number(t.getAttribute('y')) }))
    .filter((t) => t.text.length > 0)
    .sort((p, q) => p.text.localeCompare(q.text) || p.x - q.x || p.y - q.y)
  unmount()
  return out
}

const SHAPES: Array<{ name: string; contour: Point2D[]; walls: number[] }> = [
  { name: 'rectangle', contour: [[0, 0], [6000, 0], [6000, 4000], [0, 4000]], walls: [0] },
  {
    name: 'skew pentagon',
    contour: [[20, 20], [889.81, 20], [5877.298, 6884.61], [6269.409, 9124.567], [20, 9786.769]],
    walls: [1],
  },
  {
    name: 'L-shape',
    contour: [[0, 0], [4000, 0], [4000, 3000], [11960, 3000], [11960, 6460], [0, 6460]],
    walls: [0, 2],
  },
]

describe('TopPlanSheet per-edge fields', () => {
  for (const shape of SHAPES) {
    it(`${shape.name}: typed outers, a wall and a manual divider print the same labels either way`, () => {
      const n = shape.contour.length
      const outers = shape.contour.map((p, i) => {
        const q = shape.contour[(i + 1) % n]
        return Math.round(Math.hypot(q[0] - p[0], q[1] - p[1])) + 80 + 20 * i
      })
      const cwOuters = new Array<number>(n)
      for (let i = 0; i < n; i++) cwOuters[swap(i, n)] = outers[i]
      const ccwParams: PlanConstructionParams = {
        ...baseParams,
        measuredOuterLengthMmByEdgeIndex: outers,
        purlinDividers: { mode: 'manual', lines: [{ id: 'div-2500', positionMm: 2500 }] },
      }
      const cwParams: PlanConstructionParams = { ...ccwParams, measuredOuterLengthMmByEdgeIndex: cwOuters }
      const ccw = labels(shape.contour, shape.walls, ccwParams)
      const cw = labels([...shape.contour].reverse(), shape.walls.map((k) => swap(k, n)), cwParams)
      expect(ccw.length).toBeGreaterThan(0)
      // Every typed outer is printed.
      for (const mm of outers) expect(ccw.some((t) => t.text === `${mm}.0`)).toBe(true)
      expectSameLabels(cw, ccw)
    })
  }
})
