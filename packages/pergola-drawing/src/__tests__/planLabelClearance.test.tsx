// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { PERGOLA_CONSTRUCTION_PROFILES, axisLengthsFromOuterLengthsMm, buildLamellaSections, buildPieces, contourSideWidthMm, specFromPlan } from '@pashkovsky/pergola-core'
import { DEFAULT_PLAN_CONSTRUCTION_PARAMS } from '@pashkovsky/pergola-core'
import type { PlanConstructionParams, Point2D } from '@pashkovsky/pergola-core'
import { TopPlanSheet } from '../TopPlanSheet'
import { labelBox, labelConflicts, segmentsCross, separateLabels, type ScreenLabel, type ScreenSegment } from '../planLabelClearance'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub)

const SKEW: Point2D[] = [
  [0, 0],
  [6421.82181354009, 0],
  [6421.82181354009, 3726.450217473525],
  [-5163.666556354009, 3726.450217473526],
  [-5163.666556354011, -4924.179746596066],
  [212.0071388048409, -4924.179746596066],
]

function readLabels(container: HTMLElement): ScreenLabel[] {
  return [...container.querySelectorAll('[data-label-box]')].map((node) => {
    const [x, y, w, h] = (node.getAttribute('data-label-box') ?? '').split(',').map(Number)
    return {
      id: node.getAttribute('data-label-id') ?? '',
      x, y, w, h,
      nudge: { x: 0, y: -1 },
      locked: node.getAttribute('data-label-id')?.startsWith('beam-') === true
        || node.getAttribute('data-label-id')?.startsWith('letter-') === true,
    }
  })
}

function readLines(container: HTMLElement): ScreenSegment[] {
  return [...container.querySelectorAll('[data-clearance-line]')].map((node) => {
    const [x1, y1, x2, y2] = (node.getAttribute('data-clearance-line') ?? '').split(',').map(Number)
    const ownerId = node.getAttribute('data-clearance-owner')
    return { x1, y1, x2, y2, ...(ownerId ? { ownerId } : {}) }
  })
}

describe('plan label clearance', () => {
  it('moves a label off other text and off a dimension line without shrinking it', () => {
    const font = 16
    const blocked = labelBox(40, 20, '1254.1', font, 'dim', { x: 0, y: -1 })
    const other = labelBox(40, 20, '90.0°', font, 'angle', { x: 0, y: 1 })
    const line: ScreenSegment = { x1: 0, y1: 20, x2: 80, y2: 20 }
    const [dim, angle] = separateLabels([blocked, other], [line])
    expect(dim.w).toBe(blocked.w)
    expect(dim.h).toBe(blocked.h)
    expect(angle.w).toBe(other.w)
    expect(labelConflicts([dim, angle], [line])).toEqual([])
    expect(dim.y).not.toBe(blocked.y)
  })

  it('slides a beam circle along the beam and leaves the dimension where it is', () => {
    const circle: ScreenLabel = {
      id: 'beam-circle-0',
      x: 40,
      y: 20,
      w: 30,
      h: 30,
      nudge: { x: 1, y: 0 },
      slide: { x: 1, y: 0 },
    }
    const dim = labelBox(40, 20, '1254.1', 16, 'dim-0-0', { x: 0, y: -1 })
    const [movedCircle, movedDim] = separateLabels([circle, dim], [])
    expect(labelConflicts([movedCircle, movedDim], [])).toEqual([])
    expect(movedDim.x).toBe(dim.x)
    expect(movedDim.y).toBe(dim.y)
    expect(movedCircle.y).toBe(circle.y)
    expect(movedCircle.x).not.toBe(circle.x)
  })

  it('keeps the skew plan labels off each other and off the dimension lines', () => {
    const spec = specFromPlan({
      contour: SKEW,
      wallEdgeIndices: [],
      params: {
        ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
        beamProfileId: 'f10040',
        wallProfileId: 'f10040',
        wingShelfProfileId: 'purlin-plain-5030',
        wallBeamWidthVersion: 1,
        purlinClearLayoutVersion: 1,
        lamellaSectionLayoutVersion: 1,
        frameJointVersion: 1,
      },
    })
    const built = buildPieces(spec, PERGOLA_CONSTRUCTION_PROFILES)
    const sections = buildLamellaSections(spec, PERGOLA_CONSTRUCTION_PROFILES)
    const { container } = render(
      <TopPlanSheet
        pieces={built.pieces}
        profiles={PERGOLA_CONSTRUCTION_PROFILES}
        planContour={SKEW}
        sections={sections}
        showPurlinLengthLegend={false}
      />,
    )
    const labels = readLabels(container)
    const lines = readLines(container)
    expect(labels.length).toBeGreaterThan(6)
    expect(lines.length).toBeGreaterThan(4)
    for (const label of labels) expect(Number(container.querySelector(`[data-label-id="${label.id}"]`)?.getAttribute('data-label-font'))).toBeGreaterThanOrEqual(14)
    expect(labels.some((label) => label.id.startsWith('beam-circle-'))).toBe(true)
    expect(labelConflicts(labels, lines)).toEqual([])
    expect(container.querySelector('[fill="#1d4ed8"]')).toBeNull()
    expect(container.querySelector('[data-beam-mark] circle')).not.toBeNull()
  })

  it('keeps 90.0° and its leader off the 3000.0 dimension on the 12 m L', () => {
    const contour: Point2D[] = [
      [0, 0],
      [4000, 0],
      [4000, 3000],
      [11960, 3000],
      [11960, 6460],
      [0, 6460],
    ]
    const params: PlanConstructionParams = {
      ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      measuredOuterLengthMmByEdgeIndex: [4000, 3000, 8000, 3500, 12000, 6500],
      purlinMaxSpanMm: 4000,
      purlinProfileId: 'PA3022',
      beamProfileId: 'F20050',
      lamellaDirectionDeg: 0,
      lamellaSectionLayoutVersion: 1,
      purlinClearLayoutVersion: 1,
    }
    const spec = specFromPlan({ contour, wallEdgeIndices: [], params })
    const built = buildPieces(spec, PERGOLA_CONSTRUCTION_PROFILES)
    const sections = buildLamellaSections(spec, PERGOLA_CONSTRUCTION_PROFILES)
    const { container } = render(
      <TopPlanSheet
        pieces={built.pieces}
        profiles={PERGOLA_CONSTRUCTION_PROFILES}
        planContour={contour}
        sections={sections}
        showPurlinLengthLegend={false}
        wallEdgeIndices={[]}
      />,
    )
    const labels = readLabels(container)
    const lines = readLines(container)
    const angleIds = [...container.querySelectorAll('[data-label-id^="angle-"]')]
      .filter((node) => (node.textContent ?? '').includes('90.0'))
      .map((node) => node.getAttribute('data-label-id') ?? '')
    const dimIds = [...container.querySelectorAll('[data-label-id^="dim-"]')]
      .filter((node) => (node.textContent ?? '').includes('3000.0'))
      .map((node) => node.getAttribute('data-label-id') ?? '')
    expect(angleIds.length).toBeGreaterThan(0)
    expect(dimIds.length).toBeGreaterThan(0)
    const dimLabels = labels.filter((label) => dimIds.includes(label.id))
    const angleLabels = labels.filter((label) => angleIds.includes(label.id))
    const dimLines = lines.filter((line) => line.ownerId != null && dimIds.includes(line.ownerId))
    expect(labelConflicts([...angleLabels, ...dimLabels], dimLines)).toEqual([])
    const leaders = [...container.querySelectorAll('[data-leader]')].map((node) => {
      const [x1, y1, x2, y2] = (node.getAttribute('data-leader') ?? '').split(',').map(Number)
      return { id: node.getAttribute('data-leader-for') ?? '', x1, y1, x2, y2 }
    })
    for (const angle of angleLabels) {
      const leader = leaders.find((item) => item.id === angle.id)
      if (!leader) continue
      for (const line of dimLines) {
        expect(segmentsCross(leader, line)).toBe(false)
      }
      for (const dim of dimLabels) {
        const left = dim.x - dim.w / 2
        const right = dim.x + dim.w / 2
        const top = dim.y - dim.h / 2
        const bottom = dim.y + dim.h / 2
        const edges = [
          { x1: left, y1: top, x2: right, y2: top },
          { x1: right, y1: top, x2: right, y2: bottom },
          { x1: right, y1: bottom, x2: left, y2: bottom },
          { x1: left, y1: bottom, x2: left, y2: top },
        ]
        expect(edges.some((edge) => segmentsCross(leader!, edge))).toBe(false)
      }
    }
  })
})

const SHARED = {
  ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  lamellaGapMm: 20,
  wingShelfProfileId: 'purlin-plain-5030',
  wallBeamWidthVersion: 1 as const,
  lamellaDirectionDeg: 0,
  purlinMaxSpanMm: 4000,
  purlinClearLayoutVersion: 1 as const,
  lamellaSectionLayoutVersion: 1 as const,
  frameJointVersion: 1 as const,
  purlinProfileId: 'PA3022',
}

function walk(lengths: number[], angles: number[]): Point2D[] {
  let x = 0
  let y = 0
  const vertices: Point2D[] = [[0, 0]]
  for (let i = 0; i < lengths.length; i++) {
    const rad = (angles[i] * Math.PI) / 180
    x += lengths[i] * Math.cos(rad)
    y += lengths[i] * Math.sin(rad)
    if (i < lengths.length - 1) vertices.push([x, y])
  }
  return vertices
}

function renderProductionPlan(contour: Point2D[], params: PlanConstructionParams, wallEdgeIndices: number[] = [], rowBoundaryLabel?: string) {
  const spec = specFromPlan({ contour, wallEdgeIndices, params })
  const built = buildPieces(spec, PERGOLA_CONSTRUCTION_PROFILES)
  const sections = buildLamellaSections(spec, PERGOLA_CONSTRUCTION_PROFILES)
  return render(
    <TopPlanSheet
      pieces={built.pieces}
      profiles={PERGOLA_CONSTRUCTION_PROFILES}
      planContour={contour}
      constructionParams={params}
      sections={sections}
      wallEdgeIndices={wallEdgeIndices}
      showPurlinLengthLegend={false}
      rowBoundaryLabel={rowBoundaryLabel}
      lamellaDirectionLabel={rowBoundaryLabel ? 'כיוון למלות' : undefined}
      beamMark={(index) => `ק${index}`}
    />,
  )
}

const DIAGONAL_LENGTHS = [1637.1, 3813.6, 4995.1, 2898.9, 8658.5, 6129.7]
const DIAGONAL_ANGLES = [0, Math.acos(2026.3 / 3813.6) * (180 / Math.PI), 0, 90, 180, 270]
const L10_LENGTHS = [5000, 4000, 10000, 8000, 5000, 4000]
const L10_ANGLES = [0, 90, 180, 270, 0, 90]
const L10_WALLS = [0, 4, 5]

const PLANS: Array<{ name: string; contour: Point2D[]; params: PlanConstructionParams; walls?: number[]; hebrew?: boolean }> = [
  {
    name: 'notch',
    hebrew: true,
    contour: [
      [0, 0],
      [4569.400649472891, 0],
      [3900.9553840361427, 3091.320359563252],
      [-5161.95641942771, 3091.320359563253],
      [-5161.956419427711, -4277.608480798192],
      [-2324.9246987951806, -4277.608480798192],
    ],
    params: { ...SHARED, wingShelfProfileId: 'PA1296', beamProfileId: 'f10040', wallProfileId: 'f10040' },
  },
  {
    name: 'diagonal',
    contour: walk(axisLengthsFromOuterLengthsMm({ outerLengthsMm: DIAGONAL_LENGTHS, angleDeg: DIAGONAL_ANGLES, defaultBeamPlanWidthMm: 40 }), DIAGONAL_ANGLES),
    params: { ...SHARED, beamProfileId: 'f10040', wallProfileId: 'f10040', measuredOuterLengthMmByEdgeIndex: DIAGONAL_LENGTHS },
  },
  {
    name: 'skew',
    contour: SKEW,
    params: { ...SHARED, beamProfileId: 'f10040', wallProfileId: 'f10040' },
  },
  {
    name: 'l10',
    contour: walk(axisLengthsFromOuterLengthsMm({
      outerLengthsMm: L10_LENGTHS,
      angleDeg: L10_ANGLES,
      defaultBeamPlanWidthMm: 70,
      planWidthForEdge: (edgeIndex) => contourSideWidthMm(PERGOLA_CONSTRUCTION_PROFILES, edgeIndex, {
        wallEdgeIndices: L10_WALLS,
        beamProfileId: 'pa1429',
        wallProfileId: 'f10040',
        wallBeamWidthVersion: 1,
      }),
    }), L10_ANGLES),
    params: { ...SHARED, beamProfileId: 'pa1429', wallProfileId: 'f10040', measuredOuterLengthMmByEdgeIndex: L10_LENGTHS },
    walls: L10_WALLS,
  },
]

describe('production plan sheets', () => {
  it.each(PLANS)('$name keeps circles, red angles, the chain and dimensions apart', ({ contour, params, walls, hebrew }) => {
    const { container } = renderProductionPlan(
      contour,
      params,
      walls ?? [],
      hebrew ? 'גבול שורות (לא קורה)' : 'row boundary (not a beam)',
    )
    const labels = readLabels(container)
    const lines = readLines(container)
    expect(labels.some((label) => label.id.startsWith('beam-circle-'))).toBe(true)
    expect(labels.some((label) => label.id.startsWith('dim-') || label.id.startsWith('clear'))).toBe(true)
    if (hebrew || contour === PLANS[1].contour) {
      expect(labels.some((label) => label.id.startsWith('miter-'))).toBe(true)
    }
    for (const node of container.querySelectorAll('[data-label-font]')) {
      expect(Number(node.getAttribute('data-label-font'))).toBeGreaterThanOrEqual(14)
    }
    const textHits = labelConflicts(labels, lines).filter((hit) => !hit.endsWith('|line') || hit.startsWith('dim-') || hit.startsWith('clear') || hit.startsWith('shelf-') || hit.startsWith('beam-circle-'))
    expect(textHits).toEqual([])
    const summary = labels.find((label) => label.id === 'clear-summary')
    if (summary) {
      expect(summary.y - summary.h / 2).toBeGreaterThan(0)
      expect(summary.y + summary.h / 2).toBeLessThan(970)
    }
    for (const node of container.querySelectorAll('[data-miter-tip]')) {
      const label = labels.find((item) => item.id === node.getAttribute('data-label-id'))
      const [tipX, tipY] = (node.getAttribute('data-miter-tip') ?? '').split(',').map(Number)
      expect(label).toBeTruthy()
      expect(Math.hypot((label?.x ?? 0) - tipX, (label?.y ?? 0) - tipY)).toBeLessThan(130)
    }
    const text = container.textContent ?? ''
    if (hebrew) {
      expect(text).toContain('גבול שורות (לא קורה)')
      expect(text).toContain('כיוון למלות')
      expect(text).not.toMatch(/[А-Яа-яЁё]/)
    }
  })
})
