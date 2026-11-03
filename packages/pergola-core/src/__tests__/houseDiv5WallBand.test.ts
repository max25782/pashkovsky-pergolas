/**
 * House equal-clear div-5 sits inside the DE wall plan band and is culled by
 * parallel footprint overlap — length ~4555 instead of ~4530. Documents that
 * geometry and a flush-to-wall alternative at x=6805 without changing the
 * equal-clear placement rule.
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
const FLUSH_DIV5_X = DE_INNER_X + 20 // 6805: purlin left face on wall inner

function equalClearLines(clear = 1310.7142857) {
  return Array.from({ length: 6 }, (_, i) => {
    const k = i + 1
    return { id: `div-${k}`, positionMm: 40 + k * clear + (k - 1) * 40 + 20 }
  })
}

function run(lines: Array<{ id: string; positionMm: number }>) {
  const params = houseConstructionParams({
    ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
    lamellaDirectionDeg: 0,
    purlinMaxSpanMm: 4000,
    wingShelfProfileId: 'f10040',
    beamProfileId: 'f10040',
    wallProfileId: 'f10040',
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
  it('equal-clear div-5 overlaps DE [6745,6785] and stops at y≈4595 (len≈4555)', () => {
    const lines = equalClearLines()
    const div5 = lines.find((l) => l.id === 'div-5')!
    expect(div5.positionMm).toBeCloseTo(6773.6, 0)
    expect(div5.positionMm - 20).toBeGreaterThan(DE_OUTER_X)
    expect(div5.positionMm + 20).toBeLessThan(DE_INNER_X + 20)
    // Band overlaps the one-sided wall body.
    expect(div5.positionMm - 20).toBeLessThan(DE_INNER_X)
    expect(div5.positionMm + 20).toBeGreaterThan(DE_OUTER_X)

    const { purlins, lamellaTotal } = run(lines)
    const row = purlins.filter((p) => p.dividerId === 'div-5')
    expect(row).toHaveLength(1)
    expect(row[0].y1).toBeCloseTo(4595, 0)
    expect(row[0].len).toBeCloseTo(4555, 0)
    // Parallel footprint cull: DE bottom at 4615 − halfWidth 20 = 4595, not shelf inner ≈4570.
    expect(row[0].len).toBeGreaterThan(4540)
    expect(lamellaTotal).toBe(505)
  })

  it('flush div-5 @6805 clears the wall band and splits on the right shelf ≈4535+2825', () => {
    const lines = equalClearLines().map((l) =>
      l.id === 'div-5' ? { ...l, positionMm: FLUSH_DIV5_X } : l,
    )
    expect(FLUSH_DIV5_X).toBe(6805)
    const { purlins, lamellaTotal } = run(lines)
    const row = purlins.filter((p) => p.dividerId === 'div-5').sort((a, b) => a.y0 - b.y0)
    expect(row).toHaveLength(2)
    expect(row[0].band[0]).toBeCloseTo(DE_INNER_X, 0)
    expect(row[0].len).toBeCloseTo(4535, 0)
    expect(row[1].len).toBeCloseTo(2825, 0)
    expect(lamellaTotal).toBe(536)
  })
})
