import { describe, expect, it } from 'vitest'
import type { Point2D } from '../types'
import { PERGOLA_CONSTRUCTION_PROFILES } from '../pergolaProfiles'
import { DEFAULT_PLAN_CONSTRUCTION_PARAMS } from '../planDefaults'
import { specFromPlan } from '../buildPieces'
import { axisLengthsFromOuterLengthsMm } from '../planEditorOuterAxis'
import { contourSideWidthMm } from '../beamPlanWidth'
import { buildLamellaSections, factorySectionSizeMm, groupLamellaSectionTypes, sectionLabelMatchesDrawn, type LamellaSection } from '../lamellaSections'
import { computeLamellas } from '../lamellas'
import { computePurlins } from '../purlins'
import { WING_SHELF_SPAN_DIVIDER_ID } from '../planEditorDimensions'
import { computeEqualPurlinClearMm } from '../lamellaSpans'
import { packProfile, DEFAULT_KERF_MM } from '../packProfile'
import { computeFrame } from '../frame'
import { pieceAxis } from '../pieceAxis'
import { vertexAnglesForContour, expectedInteriorAngleSumDeg, contourEdgeOutward } from '../topPlanDimensions'
import type { CutPiece } from '../types'

/**
 * Live editor contour for outers 6420.9 / 3766.5 / 11625.5 / 8690.6 / 5416.6 / 4928.7.
 * Vertices are the beam centerline. L_outer is not stored on the plan.
 * Last edge closes at 92.5°.
 */
const CONTOUR: Point2D[] = [
  [0, 0],
  [6421.82181354009, 0],
  [6421.82181354009, 3726.450217473525],
  [-5163.666556354009, 3726.450217473526],
  [-5163.666556354011, -4924.179746596066],
  [212.0071388048409, -4924.179746596066],
]

const params = {
  ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  beamProfileId: 'f10040',
  lamellaGapMm: 20,
  wingShelfProfileId: 'purlin-plain-5030',
  wallBeamWidthVersion: 1 as const,
  wallProfileId: 'f10040',
  lamellaDirectionDeg: 0,
  purlinMaxSpanMm: 4000,
  purlinClearLayoutVersion: 1 as const,
  lamellaSectionLayoutVersion: 1 as const,
  frameJointVersion: 1 as const,
  purlinProfileId: 'PA3022',
}

function round1(mm: number): number {
  return Math.round(mm * 10) / 10
}

describe('skewed centerline plan — section from the purlin opening', () => {
  const spec = specFromPlan({ contour: CONTOUR, wallEdgeIndices: [], params })
  const sections = buildLamellaSections(spec, PERGOLA_CONSTRUCTION_PROFILES)
  const schedule = groupLamellaSectionTypes(sections)
  const purlins = computePurlins(spec, PERGOLA_CONSTRUCTION_PROFILES)
  const bars = purlins.filter((piece) => piece.dividerId !== WING_SHELF_SPAN_DIVIDER_ID)
  const byLength = (length: number) =>
    bars.filter((piece) => Math.abs(piece.lengthLongMm - length) < 0.15)

  // AD: where no beam sits under the notch shelf (the left wing), purlins and
  // cells stop on the shelf faces. The shelf is purlin-plain-5030, 30 mm wide
  // (half 15). The frame beam f10040 is 40 mm wide (half 20). Each such end
  // moves 20 − 15 = 5 mm, so every cut that ends on the shelf is 5 mm longer:
  // upper 3686.5 → 3691.5 (3 of the 7), lower 4884.1 → 4889.2 (3 of 3). The
  // 4 upper cuts that end on the notch beam stay 3686.5. The shelf cut itself
  // is unchanged at 5123.7.
  it('keeps the purlin cuts 4×3686.5 on the beam, 3×3691.5 and 3×4889.2 on the shelf', () => {
    expect(byLength(3686.5)).toHaveLength(4)
    expect(byLength(3691.5)).toHaveLength(3)
    expect(byLength(4889.2)).toHaveLength(3)
    expect(byLength(3686.5).length + byLength(3691.5).length).toBe(7)
    const shelf = purlins.filter((piece) => piece.dividerId === WING_SHELF_SPAN_DIVIDER_ID)
    expect(shelf).toHaveLength(1)
    expect(shelf[0].lengthLongMm).toBeCloseTo(5123.7, 0)
  })

  it('sizes A and B from the shortest overlapping purlin minus 30', () => {
    const full = sections.filter((section) => section.clearWMm > 1000)
    // 11 before AD and 11 now. The upper bay over x = 78.5 has the shelf face
    // (half 15) on its left and the beam face (half 20) on its right, a 5 mm
    // step. A lamella runs from purlin to purlin, so the bay stays one cell and
    // takes the smaller clear 3686.5 (the first cut made it 523.1 + 885.1 with a
    // lamella joint over nothing: 12 -> 13 cells, 536 -> 576 lamellas).
    expect(full).toHaveLength(11)
    const gap = computeEqualPurlinClearMm({
      outerLengthMm: 11625.4883698941,
      leftEndWidthMm: 40,
      rightEndWidthMm: 40,
      dividerCount: 7,
    })
    expect(gap).toBeCloseTo(1408.2, 1)
    for (const section of full) {
      expect(section.clearWMm).toBeCloseTo(gap, 1)
      expect(section.widthMm).toBeCloseTo(gap - 15, 1)
    }
    const upper = full.filter((section) => section.clearHMm < 4000)
    const lower = full.filter((section) => section.clearHMm > 4000)
    expect(upper).toHaveLength(8)
    expect(lower).toHaveLength(3)
    // 5 touch the notch beam (4 whole bays + the bay that straddles the change)
    // keep 3686.5; the 3 bays wholly over the 30 mm shelf are 5 mm taller.
    expect(upper.filter((section) => Math.abs(section.clearHMm - 3686.5) < 0.2)).toHaveLength(5)
    expect(upper.filter((section) => Math.abs(section.clearHMm - 3691.5) < 0.2)).toHaveLength(3)
    for (const section of upper) {
      expect(section.heightMm).toBeCloseTo(section.clearHMm - 30, 1)
      expect(section.lamellaCount).toBe(40)
    }
    for (const section of lower) {
      expect(section.clearHMm).toBeCloseTo(4889.2, 0)
      expect(section.heightMm).toBeCloseTo(4889.2 - 30, 0)
      expect(section.lamellaCount).toBe(54)
    }
    // Before: A 8 × 1393.2×3656.5, B 3 × 1393.2×4854.2, trapezoid 1, 536 lamellas.
    // Now the 3 upper cells wholly over the shelf are 5 mm taller (3661.5, own
    // type C) and the 3 lower ones likewise (4859.2). Still 12 cells, 536 lamellas.
    expect(schedule.types.map((type) => [type.typeId, type.count, type.sizeLabel, type.lamellasPerSection])).toEqual([
      ['A', 5, '1393.2×3656.5', 40],
      ['B', 3, '1393.2×4859.2', 54],
      ['C', 3, '1393.2×3661.5', 40],
      ['D', 1, '765.4 / 974.6×4859.2', 54],
    ])
    expect(schedule.totalLamellas).toBe(536)
  })

  it('sizes C as the notch remainder minus 15', () => {
    const partial = sections.filter((section) => section.clearWMm < 1000)
    // Only the lower notch remainder is narrower than a bay.
    expect(partial).toHaveLength(1)
    expect(partial.map((section) => round1(section.clearWMm))).toEqual([885.1])
    const cell = partial.find((section) => section.trapezoid)!
    // Last equal bay on the lower wing ends on a purlin face. The notch is
    // the next face. That remainder is the section clear; width = clear − 15.
    const remainder = cell.clearWMm
    expect(remainder).toBeCloseTo(885.1, 1)
    expect(cell.widthMm).toBeCloseTo(remainder - 15, 5)
    expect(cell.widthMm).toBeCloseTo(factorySectionSizeMm(remainder, cell.clearHMm).widthMm, 5)
    expect(cell.widthMm).toBeCloseTo(870.1, 1)
    const trap = cell.trapezoid
    expect(trap).toBeDefined()
    // 765.6 before: the 5 mm taller cell moves the high edge 0.2 mm along the skew.
    expect(trap?.widthAtHighMm).toBeCloseTo(765.4, 1)
    expect(trap?.widthAtLowMm).toBeCloseTo(974.6, 1)
    expect(trap?.lamellaLengthsMm).toHaveLength(54)
    expect(sectionLabelMatchesDrawn(cell)).toBe(true)
    expect(cell.heightMm).toBeCloseTo(4889.2 - 30, 0)
    expect(cell.lamellaCount).toBe(54)
    expect(cell.faceX1 === 'notch' || cell.faceX0 === 'notch' || cell.faceY0 === 'notch' || cell.faceY1 === 'notch').toBe(true)
  })

  it('lists every cell: B is the full lower bay, only C meets the skew', () => {
    const frame = computeFrame(spec, PERGOLA_CONSTRUCTION_PROFILES)
    const rows = sectionCellRows(sections, bars, frame.beams)
    const byType = (typeId: string) => rows.filter((row) => row.typeId === typeId)
    expect(byType('A')).toHaveLength(5)
    expect(byType('B')).toHaveLength(3)
    expect(byType('C')).toHaveLength(3)
    expect(byType('D')).toHaveLength(1)
    for (const row of byType('B')) {
      expect(row.widthMm).toBeCloseTo(1393.2, 1)
      expect(row.heightMm).toBeCloseTo(4859.2, 1)
      expect(row.purlinLengthMm).toBeCloseTo(4889.2, 0)
      expect(row.faces).not.toContain('notch')
    }
    const cellD = byType('D')[0]
    expect(cellD.widthMm).toBeCloseTo(765.4, 1)
    expect(cellD.heightMm).toBeCloseTo(4859.2, 1)
    expect(cellD.purlinLengthMm).toBeCloseTo(4889.2, 0)
    expect(cellD.faces).toContain('notch')
    expect(cellD.beams).toContain('beam-5')
    expect(rows).toHaveLength(12)
    expect(rows.map((row) => [row.typeId, row.widthMm, row.heightMm, row.faces])).toEqual([
      ['A', 1393.2, 3656.5, 'purlin/purlin/notch/frame'],
      ['A', 1393.2, 3656.5, 'purlin/purlin/notch/frame'],
      ['A', 1393.2, 3656.5, 'purlin/purlin/notch/frame'],
      ['A', 1393.2, 3656.5, 'purlin/purlin/notch/frame'],
      ['A', 1393.2, 3656.5, 'purlin/frame/notch/frame'],
      ['C', 1393.2, 3661.5, 'frame/purlin/support/frame'],
      ['C', 1393.2, 3661.5, 'purlin/purlin/support/frame'],
      ['C', 1393.2, 3661.5, 'purlin/purlin/support/frame'],
      ['B', 1393.2, 4859.2, 'frame/purlin/frame/support'],
      ['B', 1393.2, 4859.2, 'purlin/purlin/frame/support'],
      ['B', 1393.2, 4859.2, 'purlin/purlin/frame/support'],
      ['D', 765.4, 4859.2, 'purlin/notch/frame/support'],
    ])
  })

  it('gives C one length per row and packs them with the straight lamellas', () => {
    const cell = sections.find((section) => section.trapezoid)
    const lengths = cell?.trapezoid?.lamellaLengthsMm ?? []
    const fromTop = (row: number) => lengths[lengths.length - row]
    expect(lengths).toHaveLength(54)
    expect(new Set(lengths).size).toBe(54)
    expect([1, 2, 3, 26, 27, 28, 52, 53, 54].map((row) => [row, fromTop(row)])).toEqual([
      [1, 766],
      [2, 770],
      [3, 773],
      [26, 863],
      [27, 866],
      [28, 870],
      [52, 963],
      [53, 967],
      [54, 971],
    ])
    const after = packProfile(
      computeLamellas(spec, PERGOLA_CONSTRUCTION_PROFILES).filter((piece) => piece.role === 'lamella'),
      6000,
      DEFAULT_KERF_MM,
    )
    const { skewSectionVersion: _omitSkew, ...legacyParams } = params
    const before = packProfile(
      computeLamellas(
        specFromPlan({ contour: CONTOUR, wallEdgeIndices: [], params: legacyParams }),
        PERGOLA_CONSTRUCTION_PROFILES,
      ).filter((piece) => piece.role === 'lamella'),
      6000,
      DEFAULT_KERF_MM,
    )
    // Same 536 lamellas as before AD, so the same 128 bars and the same waste
    // (46818 legacy, 46912 with the skew rule, as before AD).
    expect(before.totalBars).toBe(128)
    expect(Math.round(before.totalWasteMm)).toBe(46818)
    expect(after.totalBars).toBe(128)
    expect(Math.round(after.totalWasteMm)).toBe(46912)
    const cuts = after.bars.flatMap((bar) => bar.pieces.map((piece) => piece.lengthLongMm))
    expect(cuts.filter((length) => length === 766)).toHaveLength(1)
    expect(cuts.filter((length) => length === 971)).toHaveLength(1)
    const paired = after.bars.filter((bar) => {
      const longs = bar.pieces.filter((piece) => Math.abs(piece.lengthLongMm - 1393.2) < 0.05).length
      const shorts = bar.pieces.filter((piece) => piece.lengthLongMm <= 897).length
      return longs === 3 && shorts === 2
    })
    expect(paired.length).toBeGreaterThan(0)
    const longPair = after.bars.find((bar) => {
      const ends = bar.pieces.map((piece) => piece.lengthLongMm).filter((length) => length >= 967)
      return ends.includes(971) && ends.includes(967)
    })
    expect(longPair).toBeUndefined()
  })

  it('places row 1 below the section top, so its cut is wider than 764.7', () => {
    const cell = sections.find((section) => section.trapezoid)
    const trap = cell?.trapezoid
    expect(trap?.lamellaLengthsMm).toHaveLength(54)
    const fromTop = trap?.upperFromTopMm ?? []
    expect(fromTop).toHaveLength(54)
    const topInset = fromTop[fromTop.length - 1]
    // 14.18 before. The cell is 5 mm taller (4859.2), so row 1 sits 14.18 + 5 = 19.18 below the top.
    expect(topInset).toBeCloseTo(19.18, 1)
    expect(fromTop[0]).toBeCloseTo(4859.2 - 70, 0)
    const shown = [1, 2, 3, 26, 27, 28, 52, 53, 54].map((row) => ({
      row,
      fromTopMm: Math.round(fromTop[fromTop.length - row] * 10) / 10,
      lengthMm: trap?.lamellaLengthsMm[fromTop.length - row],
    }))
    expect(shown.map((entry) => [entry.row, entry.lengthMm])).toEqual([
      [1, 766],
      [2, 770],
      [3, 773],
      [26, 863],
      [27, 866],
      [28, 870],
      [52, 963],
      [53, 967],
      [54, 971],
    ])
    expect(shown[0].fromTopMm).toBeGreaterThan(19)
    expect(shown[0].fromTopMm).toBeLessThan(20)
  })

  it('keeps one rectangle width when the skew rule is unset', () => {
    const { skewSectionVersion: _omitSkew, ...legacyParams } = params
    const legacy = groupLamellaSectionTypes(buildLamellaSections(
      specFromPlan({ contour: CONTOUR, wallEdgeIndices: [], params: legacyParams }),
      PERGOLA_CONSTRUCTION_PROFILES,
    ))
    // Widths are still the rectangle widths. Heights split by 5 mm (beam vs
    // shelf under the notch); the straddling bay stays one cell.
    expect(legacy.types.map((type) => type.sizeLabel)).toEqual([
      '1393.2×3656.5',
      '1393.2×4859.2',
      '1393.2×3661.5',
      '870.1×4859.2',
    ])
  })

  it('packs the same 536 lamellas on 128 bars of 6000', () => {
    const pieces = sections.flatMap((section, index) =>
      Array.from({ length: section.lamellaCount }, (_, row) => ({
        id: `lam-${index}-${row}`,
        role: 'lamella' as const,
        profileId: 'f7020',
        lengthLongMm: section.widthMm,
        lengthAxisMm: section.widthMm,
        lengthShortMm: section.widthMm,
        cutMiterStartDeg: 0,
        cutBevelStartDeg: 0,
        cutHandStart: 'straight' as const,
        cutMiterEndDeg: 0,
        cutBevelEndDeg: 0,
        cutHandEnd: 'straight' as const,
        position: [0, 0, 0] as [number, number, number],
      })),
    )
    const plan = packProfile(pieces, 6000, DEFAULT_KERF_MM)
    const patterns = new Map<string, { count: number; waste: number }>()
    for (const bar of plan.bars) {
      const lengths = new Map<number, number>()
      for (const piece of bar.pieces) {
        const length = Math.round(piece.lengthLongMm)
        lengths.set(length, (lengths.get(length) ?? 0) + 1)
      }
      const key = [...lengths.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([length, count]) => `${count}×${length}`)
        .join('+')
      const found = patterns.get(key)
      if (found) found.count += 1
      else patterns.set(key, { count: 1, waste: Math.round(bar.wasteMm) })
    }
    // Same pieces as before AD: 482 × 1393 + 54 × 870 = 536 on 128 bars.
    // Check: 100×4 + 25×3 + 3 + 2×1 + 2 = 482 and 25×2 + 1 + 3 = 54.
    expect(plan.totalBars).toBe(128)
    expect(patterns.get('4×1393')?.count).toBe(100)
    expect(patterns.get('3×1393+2×870')?.count).toBe(25)
    expect(patterns.get('3×1393+1×870')?.count).toBe(1)
    expect(patterns.get('2×1393+3×870')?.count).toBe(1)
    expect(patterns.get('2×1393')?.count).toBe(1)
    expect(Math.round(plan.totalWasteMm)).toBe(46818)
    expect(round1(plan.bars[0].wasteMm)).toBeGreaterThan(0)
  })
})

describe('wall L 10000/5000/4000 still uses the stored outer', () => {
  const outers = [5000, 4000, 10000, 8000, 5000, 4000]
  const angles = [0, 90, 180, 270, 0, 90]
  const walls = [0, 4, 5]
  const wallParams = {
    ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
    beamProfileId: 'pa1429',
    wallBeamWidthVersion: 1 as const,
    wallProfileId: 'f10040',
    lamellaDirectionDeg: 0,
    purlinMaxSpanMm: 4000,
    purlinClearLayoutVersion: 1 as const,
    lamellaSectionLayoutVersion: 1 as const,
    frameJointVersion: 1 as const,
    measuredOuterLengthMmByEdgeIndex: outers,
  }
  const widthAt = (edgeIndex: number) => contourSideWidthMm(PERGOLA_CONSTRUCTION_PROFILES, edgeIndex, {
    wallEdgeIndices: walls,
    beamProfileId: wallParams.beamProfileId,
    wallProfileId: wallParams.wallProfileId,
    wallBeamWidthVersion: 1,
  })
  const axis = axisLengthsFromOuterLengthsMm({
    outerLengthsMm: outers,
    angleDeg: angles,
    defaultBeamPlanWidthMm: 70,
    planWidthForEdge: widthAt,
  })
  let x = 0
  let y = 0
  const contour: Point2D[] = [[0, 0]]
  for (let i = 0; i < axis.length; i++) {
    const rad = (angles[i] * Math.PI) / 180
    x += axis[i] * Math.cos(rad)
    y += axis[i] * Math.sin(rad)
    if (i < axis.length - 1) contour.push([x, y])
  }
  const spec = specFromPlan({ contour, wallEdgeIndices: walls, params: wallParams })
  const schedule = groupLamellaSectionTypes(buildLamellaSections(spec, PERGOLA_CONSTRUCTION_PROFILES))

  it('keeps A 3860, B/C 3930, and C width 632.1', () => {
    expect(schedule.types.map((type) => [type.typeId, type.count, type.sizeLabel])).toEqual([
      ['A', 7, '1359.3×3860'],
      ['B', 3, '1359.3×3930'],
      ['C', 1, '632.1×3930'],
    ])
  })
})

interface SectionCellRow {
  id: string
  typeId: string
  widthMm: number
  heightMm: number
  purlinLengthMm: number
  beams: string
  faces: string
}

function sectionCellRows(sections: LamellaSection[], purlins: CutPiece[], beams: CutPiece[]): SectionCellRow[] {
  const schedule = groupLamellaSectionTypes(sections)
  const typeOf = new Map<string, string>()
  for (const type of schedule.types) {
    for (const id of type.sectionIds) typeOf.set(id, type.typeId)
  }
  const vertical = purlins.flatMap((piece) => {
    const { start, end } = pieceAxis(piece)
    if (Math.abs(end[0] - start[0]) > 30) return []
    return [{
      lengthMm: piece.lengthLongMm,
      x: (start[0] + end[0]) / 2,
      y0: Math.min(start[1], end[1]),
      y1: Math.max(start[1], end[1]),
    }]
  })
  return sections.map((section) => {
    const midX = (section.minX + section.maxX) / 2
    const near = vertical.filter((purlin) =>
      purlin.x >= section.minX - 120
      && purlin.x <= section.maxX + 120
      && purlin.y1 > section.minY + 20
      && purlin.y0 < section.maxY - 20
    )
    const left = near.filter((purlin) => purlin.x <= midX).sort((a, b) => b.x - a.x)[0]
    const right = near.filter((purlin) => purlin.x >= midX).sort((a, b) => a.x - b.x)[0]
    const bounds = [left, right].filter((purlin) => purlin != null)
    const heightFrom = [...bounds].sort((a, b) => a.lengthMm - b.lengthMm)[0]
    const faces = [section.faceX0, section.faceX1, section.faceY0, section.faceY1]
    return {
      id: section.id,
      typeId: typeOf.get(section.id) ?? '?',
      widthMm: Math.round((section.trapezoid?.widthAtHighMm ?? section.widthMm) * 10) / 10,
      heightMm: Math.round(section.heightMm * 10) / 10,
      purlinLengthMm: heightFrom ? Math.round(heightFrom.lengthMm * 10) / 10 : 0,
      beams: [
        left ? `L ${Math.round(left.lengthMm * 10) / 10}` : 'L frame',
        right ? `R ${Math.round(right.lengthMm * 10) / 10}` : 'R frame',
        beamLabels(section, beams),
      ].filter(Boolean).join(' | '),
      faces: faces.join('/'),
    }
  })
}

function beamLabels(section: LamellaSection, beams: CutPiece[]): string {
  const sides: Array<{ face: string; point: [number, number]; alongX: boolean }> = [
    { face: section.faceX0, point: [section.minX, (section.minY + section.maxY) / 2], alongX: false },
    { face: section.faceX1, point: [section.maxX, (section.minY + section.maxY) / 2], alongX: false },
    { face: section.faceY0, point: [(section.minX + section.maxX) / 2, section.minY], alongX: true },
    { face: section.faceY1, point: [(section.minX + section.maxX) / 2, section.maxY], alongX: true },
  ]
  const names: string[] = []
  for (const side of sides) {
    if (side.face !== 'frame' && side.face !== 'support' && side.face !== 'notch') continue
    let best = ''
    let bestDist = 70
    for (const beam of beams) {
      const { start, end } = pieceAxis(beam)
      const dx = end[0] - start[0]
      const dy = end[1] - start[1]
      const len = Math.hypot(dx, dy)
      if (len < 1) continue
      const parallel = side.alongX ? Math.abs(dx) > Math.abs(dy) : Math.abs(dy) > Math.abs(dx)
      if (!parallel) continue
      const dist = Math.abs((side.point[0] - start[0]) * dy - (side.point[1] - start[1]) * dx) / len
      if (dist < bestDist) {
        bestDist = dist
        best = `${side.face} ${beam.id} ${Math.round(beam.lengthLongMm)}`
      }
    }
    if (best) names.push(best)
    else names.push(side.face)
  }
  return names.join('; ')
}

describe('skewed plan interior angles', () => {
  it('sums to (6−2)×180 = 720, concave 272.5 and skew 87.5', () => {
    const { angles, warning } = vertexAnglesForContour(CONTOUR)
    expect(warning).toBeNull()
    expect(angles).toHaveLength(6)
    const sum = angles.reduce((total, entry) => total + entry.interiorAngleDeg, 0)
    expect(sum).toBeCloseTo(expectedInteriorAngleSumDeg(6), 1)
    expect(angles[0].interiorAngleDeg).toBeCloseTo(272.5, 1)
    expect(angles[5].interiorAngleDeg).toBeCloseTo(87.5, 1)
    for (const index of [1, 2, 3, 4]) {
      expect(angles[index].interiorAngleDeg).toBeCloseTo(90, 1)
    }
  })

  it('puts the skewed edge dimension into the notch, on the +X side', () => {
    const outward = contourEdgeOutward(CONTOUR, 5)
    expect(outward[0]).toBeGreaterThan(0.9)
    expect(Math.abs(outward[1])).toBeLessThan(0.2)
  })

  it('does not draw a corner when the typed heading misses the contour', () => {
    const headings = [0, 90, 180, 270, 0, 102.5]
    const { angles, warning } = vertexAnglesForContour(CONTOUR, { edgeHeadingDeg: headings })
    expect(angles).toEqual([])
    expect(warning).toContain('не сходятся')
  })
})
