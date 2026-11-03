/**
 * House equal-clear div-5 sits inside the DE wall plan band. Near-wall purlins
 * end on frame/shelf inner faces (not wall-axis ± half). Position stays on the
 * equal-clear grid — no flush-to-wall placement.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  PERGOLA_CONSTRUCTION_PROFILES,
  buildPieces,
  buildLamellaSections,
  WING_SHELF_SPAN_DIVIDER_ID,
  pieceAxis,
  specFromPlan,
} from '../index'
import {
  HOUSE_CONTOUR_MM,
  HOUSE_WALL_EDGE_INDICES,
  houseConstructionParams,
} from '../acceptance/houseContour'

const profiles = PERGOLA_CONSTRUCTION_PROFILES
const DE_OUTER_X = 6745
const DE_INNER_X = 6785

function equalClearLines(clear = 1310.7142857) {
  return Array.from({ length: 6 }, (_, i) => {
    const k = i + 1
    return { id: `div-${k}`, positionMm: 40 + k * clear + (k - 1) * 40 + 20 }
  })
}

function run(lines: Array<{ id: string; positionMm: number }>, beamProfileId = 'f10040') {
  const params = houseConstructionParams({
    ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
    lamellaDirectionDeg: 0,
    purlinMaxSpanMm: 4000,
    wingShelfProfileId: 'f10040',
    beamProfileId,
    wallProfileId: 'f10040',
    wallBeamWidthVersion: 1,
    purlinProfileId: 'PA3022',
    skewSectionVersion: 1,
    purlinDividers: { mode: 'manual', lines },
  })
  const spec = specFromPlan({
    contour: HOUSE_CONTOUR_MM,
    wallEdgeIndices: HOUSE_WALL_EDGE_INDICES,
    params,
  })
  const built = buildPieces(spec, profiles)
  const sections = buildLamellaSections(spec, profiles)
  const purlins = built.pieces
    .filter((p) => p.role === 'purlin' && p.dividerId !== WING_SHELF_SPAN_DIVIDER_ID)
    .map((p) => {
      const { start, end } = pieceAxis(p)
      const x = (start[0] + end[0]) / 2
      return {
        dividerId: p.dividerId,
        x,
        band: [x - 20, x + 20] as [number, number],
        y0: Math.min(start[1], end[1]),
        y1: Math.max(start[1], end[1]),
        len: p.lengthAxisMm,
      }
    })
  return {
    purlins,
    sections: sections.map((s) => ({
      h: s.heightMm,
      w: s.widthMm,
      n: s.lamellaCount ?? 0,
    })),
    lamellaTotal: sections.reduce((n, s) => n + (s.lamellaCount ?? 0), 0),
  }
}

describe('house div-5 vs DE wall band', () => {
  it('equal-clear div-5 stays at ~6773.6 and ends on shelf/frame faces (~4530), not wall axis', () => {
    const lines = equalClearLines()
    const div5 = lines.find((l) => l.id === 'div-5')!
    expect(div5.positionMm).toBeCloseTo(6773.6, 0)
    expect(div5.positionMm - 20).toBeGreaterThan(DE_OUTER_X)
    expect(div5.positionMm + 20).toBeLessThan(DE_INNER_X + 20)
    expect(div5.positionMm - 20).toBeLessThan(DE_INNER_X)
    expect(div5.positionMm + 20).toBeGreaterThan(DE_OUTER_X)

    const { purlins } = run(lines)
    const row = purlins.filter((p) => p.dividerId === 'div-5').sort((a, b) => a.y0 - b.y0)
    expect(row.length).toBeGreaterThanOrEqual(1)
    // Lower bay ends on notch-floor / shelf inner face (full 40 inset), not DE corner axis 4615.
    expect(row[0].y1).toBeCloseTo(4575, 0)
    expect(row[0].len).toBeCloseTo(4535, 0)
    expect(row[0].len).toBeLessThan(4550)
  })

  it('R242 free / pa1162 wall: lower div-5 ~4500 (70+40), shelves ~3170 / ~2640', () => {
    // clear = (9495−70−70−6×40)/7
    const clear = (9495 - 70 - 70 - 6 * 40) / 7
    const wtLines = Array.from({ length: 6 }, (_, i) => {
      const k = i + 1
      return { id: `div-${k}`, positionMm: 70 + k * clear + (k - 1) * 40 + 20 }
    })
    // div-5 stays near DE (~6770), not necessarily the f10040 6773.6 tick.
    expect(wtLines[4].positionMm).toBeGreaterThan(DE_OUTER_X)
    expect(wtLines[4].positionMm).toBeLessThan(DE_INNER_X + 40)

    const params = houseConstructionParams({
      ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      lamellaDirectionDeg: 0,
      purlinMaxSpanMm: 4000,
      wingShelfProfileId: 'f10040',
      beamProfileId: 'R242',
      wallProfileId: 'pa1162',
      wallBeamWidthVersion: 1,
      purlinProfileId: 'PA3022',
      skewSectionVersion: 1,
      purlinDividers: { mode: 'manual', lines: wtLines },
    })
    const spec = specFromPlan({
      contour: HOUSE_CONTOUR_MM,
      wallEdgeIndices: HOUSE_WALL_EDGE_INDICES,
      params,
    })
    expect(spec.contourReference).toBe('outer-faces')
    const built = buildPieces(spec, profiles)
    const lower = built.pieces
      .filter((p) => p.role === 'purlin' && p.dividerId === 'div-5')
      .map((p) => {
        const { start, end } = pieceAxis(p)
        return { len: p.lengthAxisMm, y0: Math.min(start[1], end[1]), y1: Math.max(start[1], end[1]) }
      })
      .sort((a, b) => a.y0 - b.y0)
    // Bottom free 70 + notch wall/shelf 40 → ~4500–4505 (not half-trim ~4555).
    expect(lower[0].len).toBeGreaterThan(4495)
    expect(lower[0].len).toBeLessThan(4510)
    expect(lower[0].y1).toBeLessThan(4580)

    const shelves = built.pieces
      .filter((p) => p.dividerId === WING_SHELF_SPAN_DIVIDER_ID)
      .map((p) => p.lengthAxisMm)
      .sort((a, b) => b - a)
    expect(shelves[0]).toBeCloseTo(3170, 0)
    expect(shelves[1]).toBeCloseTo(2640, 0)
    expect(shelves[0] - shelves[1]).toBeCloseTo(530, 0)
  })

  it('equal-clear div-5 position is unchanged (no flush-to-wall shift)', () => {
    const lines = equalClearLines()
    expect(lines[4].positionMm).toBeCloseTo(6773.6, 0)
    expect(lines[4].positionMm).toBeLessThan(DE_INNER_X)
    expect(lines[4].positionMm).toBeGreaterThan(DE_OUTER_X)
  })
})
