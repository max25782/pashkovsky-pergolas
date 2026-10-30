import { describe, it, expect } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildPieces,
  buildPlanEditorOverlayModel,
  buildTopPlanDimensionModel,
  computeFrame,
  computeMaxEqualPurlinClearGapMm,
  contourRangeAlongLamellaDir,
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  PERGOLA_CONSTRUCTION_PROFILES,
  pieceAxis,
  resolvePlanPurlinLines,
  resolvePurlinPositionsMm,
  specFromPlan,
  WING_SHELF_SPAN_DIVIDER_ID,
} from '@pashkovsky/pergola-core'
const G_SLOPE_FIXTURE: Point2D[] = [
  [0, 0],
  [0, 9996],
  [13002, 9996],
  [13002, 4622],
]
import type { PergolaSpec, Point2D, ProfileDimensions } from '@pashkovsky/pergola-core'
import { groupBeamsIntoGeometricSides } from '../geometry/beamRuns'
import { buildDimensionLineLayout } from '../geometry/dimensionLayout'
import { renderPlanDimensionsSvg } from '../planDimensionsSvg'

const BEAM: ProfileDimensions = { widthMm: 40, heightMm: 100, maxSpanMm: 6000 }
const POST: ProfileDimensions = { widthMm: 80, heightMm: 80 }
const PROFILES = new Map<string, ProfileDimensions>([
  ['beam-1', BEAM],
  ['post-1', POST],
])

function baseSpec(contour: Point2D[]): PergolaSpec {
  return {
    contour,
    heightMm: 2600,
    lamellaGapMm: 20,
    lamellaAngleDeg: 0,
    lamellaDirectionDeg: 0,
    postProfileId: 'post-1',
    beamProfileId: 'beam-1',
    lamellaProfileId: 'lam-1',
    color: '#fff',
  }
}

function centroidOf(points: Point2D[]): Point2D {
  const sum = points.reduce<Point2D>((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0])
  return [sum[0] / points.length, sum[1] / points.length]
}

describe('G-shape 2D dimension SVG snapshot', () => {
  it('writes TopPlan-aligned SVG to .screenshots', () => {
    const contour = [...G_SLOPE_FIXTURE]
    const frame = computeFrame(baseSpec(contour), PROFILES)
    const sides = groupBeamsIntoGeometricSides(frame.beams)
    const drawContour = sides.map((s) => s.start)
    const model = buildTopPlanDimensionModel({
      geometricSides: sides,
      beams: frame.beams,
      profiles: PROFILES,
      beamProfileId: 'beam-1',
      centroid: centroidOf(contour),
      contourVertices: contour,
      lamellaDirectionDeg: 0,
      dividerPositions: [],
    })
    const svg = renderPlanDimensionsSvg({
      contour: drawContour,
      model,
      geometricSides: sides,
      centroid: centroidOf(drawContour),
      lamellaDirectionDeg: 0,
    })
    const outDir = join(process.cwd(), '..', '..', '.screenshots')
    mkdirSync(outDir, { recursive: true })
    writeFileSync(join(outDir, '2d-g-shape-dimensions-after.svg'), svg)
    expect(svg).toContain('°')
    expect((svg.match(/font-size="220"/g) ?? []).length).toBe(4)
  })

  it('midot measured labels on the top-plan SVG are 4000/3000/8000/6000/4000/3000', () => {
    const contour: Point2D[] = [
      [0, 0],
      [4000, 0],
      [4000, 3000],
      [-4000, 3000],
      [-4000, -3000],
      [0, -3000],
    ]
    const frame = computeFrame(baseSpec(contour), PROFILES)
    const sides = groupBeamsIntoGeometricSides(frame.beams)
    const model = buildTopPlanDimensionModel({
      geometricSides: sides,
      beams: frame.beams,
      profiles: PROFILES,
      beamProfileId: 'beam-1',
      centroid: centroidOf(contour),
      contourVertices: contour,
      lamellaDirectionDeg: 0,
      dividerPositions: [],
      measuredOuterLengthMmByEdgeIndex: [4000, 3000, 8000, 6000, 4000, 3000],
    })
    const labels = model.perimeterChains.map((c) => c.segmentsMm[0]).sort((a, b) => a - b)
    expect(labels).toEqual([3000, 3000, 4000, 4000, 6000, 8000])
    const svg = renderPlanDimensionsSvg({
      contour: sides.map((s) => s.start),
      model,
      geometricSides: sides,
      centroid: centroidOf(sides.map((s) => s.start)),
      lamellaDirectionDeg: 0,
    })
    expect(svg).toContain('>8000<')
    expect(svg).toContain('>6000<')
    expect(svg).not.toContain('>8080<')
    expect(svg).not.toContain('>6080<')
  })

  it('midot 8000 auto clears are equal Max-rule 6×1287, not 1273/1293', () => {
    const contour: Point2D[] = [
      [0, 0],
      [4000, 0],
      [4000, 3000],
      [-4000, 3000],
      [-4000, -3000],
      [0, -3000],
    ]
    const range = contourRangeAlongLamellaDir(contour, 0)
    const dividers = resolvePurlinPositionsMm({
      rangeMinMm: range.minMm,
      rangeMaxMm: range.maxMm,
      maxSpanMm: 1500,
      endBeamPlanWidthMm: 40,
    })
    expect(dividers).toHaveLength(5)
    const expected = computeMaxEqualPurlinClearGapMm(8000, 40, 5)
    expect(expected).toBeCloseTo(7720 / 6, 6)

    const frame = computeFrame(baseSpec(contour), PROFILES)
    const sides = groupBeamsIntoGeometricSides(frame.beams)
    const model = buildTopPlanDimensionModel({
      geometricSides: sides,
      beams: frame.beams,
      profiles: PROFILES,
      beamProfileId: 'beam-1',
      centroid: centroidOf(contour),
      contourVertices: contour,
      lamellaDirectionDeg: 0,
      dividerPositions: dividers,
      measuredOuterLengthMmByEdgeIndex: [4000, 3000, 8000, 6000, 4000, 3000],
    })
    expect(model.purlinClearChain).not.toBeNull()
    expect(model.purlinClearChain!.segmentsMm).toHaveLength(6)
    for (const gap of model.purlinClearChain!.segmentsMm) {
      expect(gap).toBeCloseTo(expected, 6)
    }
    expect(model.purlinClearDisplaySummary?.sectionClearLabel).toBe('1286.7')
    expect(model.purlinClearDisplaySummary?.sectionCount).toBe(6)
    const svg = renderPlanDimensionsSvg({
      contour: sides.map((s) => s.start),
      model,
      geometricSides: sides,
      centroid: centroidOf(sides.map((s) => s.start)),
      lamellaDirectionDeg: 0,
    })
    const outDir = join(process.cwd(), '..', '..', '.screenshots')
    mkdirSync(outDir, { recursive: true })
    writeFileSync(join(outDir, 'midot-equal-clears-after.svg'), svg)
    expect(svg).toContain('6×1286.7')
    expect(svg).not.toContain('1273')
    expect(svg).not.toContain('1293')
  })

  it('double-T 70 mm ends + 5×40 dividers: 6×1277, not leftover 1287 middles', () => {
    const contour: Point2D[] = [
      [0, 0],
      [4000, 0],
      [4000, 3000],
      [-4000, 3000],
      [-4000, -3000],
      [0, -3000],
    ]
    const range = contourRangeAlongLamellaDir(contour, 0)
    const dividers = resolvePurlinPositionsMm({
      rangeMinMm: range.minMm,
      rangeMaxMm: range.maxMm,
      maxSpanMm: 1500,
      endBeamPlanWidthMm: 70,
      outerLengthMm: 8000,
    })
    const expected = computeMaxEqualPurlinClearGapMm(8000, 70, 5)
    expect(expected).toBeCloseTo(7660 / 6, 6)

    const frame = computeFrame(baseSpec(contour), PROFILES)
    const sides = groupBeamsIntoGeometricSides(frame.beams)
    const model = buildTopPlanDimensionModel({
      geometricSides: sides,
      beams: frame.beams,
      profiles: new Map([['beam-1', { ...BEAM, planWidthMm: 70, planWidthSource: 'override-70' }], ['post-1', POST]]),
      beamProfileId: 'beam-1',
      centroid: centroidOf(contour),
      contourVertices: contour,
      lamellaDirectionDeg: 0,
      dividerPositions: dividers,
      measuredOuterLengthMmByEdgeIndex: [4000, 3000, 8000, 6000, 4000, 3000],
    })
    expect(model.purlinClearDisplaySummary?.sectionClearLabel).toBe('1276.7')
    expect(model.purlinClearDisplaySummary?.sectionCount).toBe(6)
    const svg = renderPlanDimensionsSvg({
      contour: sides.map((s) => s.start),
      model,
      geometricSides: sides,
      centroid: centroidOf(sides.map((s) => s.start)),
      lamellaDirectionDeg: 0,
    })
    const outDir = join(process.cwd(), '..', '..', '.screenshots')
    mkdirSync(outDir, { recursive: true })
    writeFileSync(join(outDir, 'midot-equal-clears-double-t-70.svg'), svg)
    expect(svg).toContain('6×1276.7')
    expect(svg).not.toContain('6×1287')
  })

  it('12000 outer / 8×40 / frame 40 → 9×1288.9; 6000 / double-T 70 / 4 div → 5×1140.0', () => {
    const L: Point2D[] = [
      [0, 0],
      [4000, 0],
      [4000, 3000],
      [11960, 3000],
      [11960, 6460],
      [0, 6460],
    ]
    const measured = [4000, 3000, 8000, 3500, 12000, 6500]
    const params = {
      ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      beamProfileId: 'f10040',
      postProfileId: 'f8080',
      measuredOuterLengthMmByEdgeIndex: measured,
      purlinClearLayoutVersion: 1 as const,
    }
    const dividers = resolvePlanPurlinLines(L, params, PERGOLA_CONSTRUCTION_PROFILES)
    const frame = computeFrame({
      ...baseSpec(L),
      beamProfileId: 'f10040',
      postProfileId: 'f8080',
      lamellaProfileId: 'f7020',
      purlinProfileId: 'purlin-led-6040',
    }, PERGOLA_CONSTRUCTION_PROFILES)
    const sides = groupBeamsIntoGeometricSides(frame.beams)
    const model = buildTopPlanDimensionModel({
      geometricSides: sides,
      beams: frame.beams,
      profiles: PERGOLA_CONSTRUCTION_PROFILES,
      beamProfileId: 'f10040',
      centroid: centroidOf(L),
      contourVertices: L,
      lamellaDirectionDeg: 0,
      dividerPositions: dividers,
      measuredOuterLengthMmByEdgeIndex: measured,
      purlinClearLayoutVersion: 1,
    })
    expect(model.purlinClearDisplaySummary?.sectionClearLabel).toBe('1288.9')
    expect(model.purlinClearDisplaySummary?.sectionCount).toBe(9)
    const chain = model.purlinClearChain!
    expect(chain.segmentsMm).toHaveLength(9)
    for (const seg of chain.segmentsMm) expect(seg).toBeCloseTo(11600 / 9, 5)
    const layout = buildDimensionLineLayout(chain, [0, 1], 320)
    expect(layout.segments).toHaveLength(9)
    for (const seg of layout.segments) {
      expect(seg.lengthMm).toBeCloseTo(11600 / 9, 5)
      expect(seg.lengthMm).not.toBeCloseTo(1248.9, 0)
    }
    expect(layout.segments.reduce((a, s) => a + s.lengthMm, 0)).toBeCloseTo(11600, 5)
    const svg = renderPlanDimensionsSvg({
      contour: sides.map((s) => s.start),
      model,
      geometricSides: sides,
      centroid: centroidOf(sides.map((s) => s.start)),
      lamellaDirectionDeg: 0,
    })
    const outDir = join(process.cwd(), '..', '..', '.screenshots')
    mkdirSync(outDir, { recursive: true })
    writeFileSync(join(outDir, 'l-shape-12000-clears-1288.9.svg'), svg)
    expect(svg).toContain('9×1288.9')
    expect(svg).not.toContain('9×1284')
    expect(svg).not.toContain('9×1278')

    const rect: Point2D[] = [[0, 0], [6000, 0], [6000, 3000], [0, 3000]]
    const params70 = {
      ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      beamProfileId: 'R242',
      postProfileId: 'f8080',
      measuredOuterLengthMmByEdgeIndex: [6000, 3000, 6000, 3000],
      purlinClearLayoutVersion: 1 as const,
    }
    const div70 = resolvePlanPurlinLines(rect, params70, PERGOLA_CONSTRUCTION_PROFILES)
    expect(div70).toHaveLength(4)
    const frame70 = computeFrame({
      ...baseSpec(rect),
      beamProfileId: 'R242',
      postProfileId: 'f8080',
      lamellaProfileId: 'f7020',
      purlinProfileId: 'purlin-led-6040',
    }, PERGOLA_CONSTRUCTION_PROFILES)
    const sides70 = groupBeamsIntoGeometricSides(frame70.beams)
    const model70 = buildTopPlanDimensionModel({
      geometricSides: sides70,
      beams: frame70.beams,
      profiles: PERGOLA_CONSTRUCTION_PROFILES,
      beamProfileId: 'R242',
      centroid: centroidOf(rect),
      contourVertices: rect,
      lamellaDirectionDeg: 0,
      dividerPositions: div70,
      measuredOuterLengthMmByEdgeIndex: [6000, 3000, 6000, 3000],
      purlinClearLayoutVersion: 1,
    })
    expect(model70.purlinClearDisplaySummary?.sectionClearLabel).toBe('1140.0')
    expect(model70.purlinClearDisplaySummary?.sectionCount).toBe(5)
    const svg70 = renderPlanDimensionsSvg({
      contour: sides70.map((s) => s.start),
      model: model70,
      geometricSides: sides70,
      centroid: centroidOf(sides70.map((s) => s.start)),
      lamellaDirectionDeg: 0,
    })
    writeFileSync(join(outDir, 'rect-6000-double-t-1140.svg'), svg70)
    expect(svg70).toContain('5×1140.0')
  })
})

describe('Midot L wing-shelf screenshots', () => {
  const MIDOT: Point2D[] = [
    [0, 0],
    [4000, 0],
    [4000, 3000],
    [-4000, 3000],
    [-4000, -3000],
    [0, -3000],
  ]

  it('writes 2D overlay, top-plan, and 3D-piece plan SVGs', () => {
    const params = { ...DEFAULT_PLAN_CONSTRUCTION_PARAMS, lamellaDirectionDeg: 0, purlinMaxSpanMm: 4000 }
    const overlay = buildPlanEditorOverlayModel({
      contour: MIDOT,
      wallEdgeIndices: [],
      params,
      profiles: PERGOLA_CONSTRUCTION_PROFILES,
    })
    expect(overlay).not.toBeNull()
    const wing = overlay!.dividerLines.find((l) => l.dividerId === WING_SHELF_SPAN_DIVIDER_ID)
    expect(wing).toBeDefined()

    const spec = specFromPlan({ contour: MIDOT, wallEdgeIndices: [], params })
    const built = buildPieces(spec, PERGOLA_CONSTRUCTION_PROFILES)
    const frame = computeFrame(spec, PERGOLA_CONSTRUCTION_PROFILES)
    const sides = groupBeamsIntoGeometricSides(frame.beams)
    const model = buildTopPlanDimensionModel({
      geometricSides: sides,
      beams: frame.beams,
      profiles: PERGOLA_CONSTRUCTION_PROFILES,
      beamProfileId: params.beamProfileId,
      centroid: centroidOf(MIDOT),
      contourVertices: MIDOT,
      lamellaDirectionDeg: 0,
      dividerPositions: resolvePlanPurlinLines(MIDOT, params, PERGOLA_CONSTRUCTION_PROFILES),
      purlinClearLayoutVersion: 1,
    })
    const topSvg = renderPlanDimensionsSvg({
      contour: sides.map((s) => s.start),
      model,
      geometricSides: sides,
      centroid: centroidOf(sides.map((s) => s.start)),
      lamellaDirectionDeg: 0,
    })

    const allPts = [
      ...MIDOT,
      ...overlay!.dividerLines.flatMap((l) => [l.start, l.end]),
    ]
    const xs = allPts.map((p) => p[0])
    const ys = allPts.map((p) => p[1])
    const pad = 400
    const minX = Math.min(...xs) - pad
    const minY = Math.min(...ys) - pad
    const w = Math.max(...xs) - minX + pad
    const h = Math.max(...ys) - minY + pad
    const sx = (p: Point2D) => ((p[0] - minX) / w) * 520
    const sy = (p: Point2D) => (1 - (p[1] - minY) / h) * 360
    const overlayLines = overlay!.dividerLines.map((l) => {
      const stroke = l.isWingShelfSpan ? '#c2410c' : '#fb923c'
      const label = l.isWingShelfSpan ? `<text x="${((sx(l.start)+sx(l.end))/2).toFixed(1)}" y="${((sy(l.start)+sy(l.end))/2).toFixed(1)}" text-anchor="middle" font-size="14" fill="#c2410c">${Math.round(l.lengthMm ?? 0)}</text>` : ''
      return `<line x1="${sx(l.start).toFixed(1)}" y1="${sy(l.start).toFixed(1)}" x2="${sx(l.end).toFixed(1)}" y2="${sy(l.end).toFixed(1)}" stroke="${stroke}" stroke-width="3"/>${label}`
    })
    const poly = MIDOT.map((p) => `${sx(p).toFixed(1)},${sy(p).toFixed(1)}`).join(' ')
    const overlaySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 360" width="520" height="360">${`<polygon points="${poly}" fill="#f8fafc" stroke="#0f172a" stroke-width="2"/>`}${overlayLines.join('')}</svg>`

    const pieceLines = built.pieces.filter((p) => p.role === 'beam' || p.role === 'purlin' || p.role === 'post').map((p) => {
      if (p.role === 'post') {
        return `<circle cx="${sx([p.position[0], p.position[2]]).toFixed(1)}" cy="${sy([p.position[0], p.position[2]]).toFixed(1)}" r="4" fill="#111827"/>`
      }
      const { start, end } = pieceAxis(p)
      const shelf = p.dividerId === WING_SHELF_SPAN_DIVIDER_ID
      return `<line x1="${sx(start).toFixed(1)}" y1="${sy(start).toFixed(1)}" x2="${sx(end).toFixed(1)}" y2="${sy(end).toFixed(1)}" stroke="${shelf ? '#c2410c' : p.role === 'beam' ? '#334155' : '#d97706'}" stroke-width="${shelf ? 3 : 2}"/>`
    })
    const threeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 360" width="520" height="360">${`<polygon points="${poly}" fill="#f8fafc" stroke="#94a3b8" stroke-width="1"/>`}${pieceLines.join('')}</svg>`

    const outDir = join(process.cwd(), '..', '..', '.screenshots')
    mkdirSync(outDir, { recursive: true })
    const shelfPiece = built.pieces.find((p) => p.dividerId === WING_SHELF_SPAN_DIVIDER_ID)
    expect(shelfPiece).toBeDefined()
    const shelfAxis = pieceAxis(shelfPiece!)
    const shelfMid: Point2D = [
      (shelfAxis.start[0] + shelfAxis.end[0]) / 2,
      (shelfAxis.start[1] + shelfAxis.end[1]) / 2,
    ]
    const topSvgWithShelf = topSvg.replace(
      '</svg>',
      `<line x1="${shelfAxis.start[0]}" y1="${shelfAxis.start[1]}" x2="${shelfAxis.end[0]}" y2="${shelfAxis.end[1]}" stroke="#c2410c" stroke-width="40"/>` +
        `<text x="${shelfMid[0]}" y="${shelfMid[1]}" text-anchor="middle" font-size="180" font-family="Arial, sans-serif" fill="#c2410c">${Math.round(shelfPiece!.lengthAxisMm)}</text></svg>`,
    )

    writeFileSync(join(outDir, 'midot-l-wing-shelf-2d.svg'), overlaySvg)
    writeFileSync(join(outDir, 'midot-l-wing-shelf-topplan.svg'), topSvgWithShelf)
    writeFileSync(join(outDir, 'midot-l-wing-shelf-3d.svg'), threeSvg)
    expect(overlaySvg).toContain('#c2410c')
    expect(threeSvg).toContain('#c2410c')
    expect(topSvgWithShelf).toContain('#c2410c')
    expect(topSvgWithShelf).toContain(String(Math.round(shelfPiece!.lengthAxisMm)))
  })
})
