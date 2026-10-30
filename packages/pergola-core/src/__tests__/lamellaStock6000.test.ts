import { describe, expect, it } from 'vitest'
import type { CutPiece, Point2D } from '../types'
import { buildPiecesFromPlan } from '../buildPieces'
import { DEFAULT_KERF_MM, packProfile } from '../packProfile'
import { DEFAULT_PLAN_CONSTRUCTION_PARAMS } from '../planDefaults'
import {
  CONSTRUCTION_PURLIN_IDS,
  hollowRectWeightKgPerM,
  isRetiredProfileId,
  LAMELLA_40_09_ID,
  LAMELLA_70_08_ID,
  PERGOLA_CONSTRUCTION_PROFILES,
} from '../pergolaProfiles'
import { axisLengthsFromOuterLengthsMm } from '../planEditorOuterAxis'
import { contourSideWidthMm } from '../beamPlanWidth'

const OUTERS = [5000, 4000, 10000, 8000, 5000, 4000]
const ANGLES = [0, 90, 180, 270, 0, 90]
const WALLS = [0, 4, 5]

function contourFrom(lengthsMm: number[], angleDeg: number[]): Point2D[] {
  let x = 0
  let y = 0
  const vertices: Point2D[] = [[x, y]]
  for (let i = 0; i < lengthsMm.length; i++) {
    const rad = (angleDeg[i] * Math.PI) / 180
    x += lengthsMm[i] * Math.cos(rad)
    y += lengthsMm[i] * Math.sin(rad)
    if (i < lengthsMm.length - 1) vertices.push([x, y])
  }
  return vertices
}

function wallLLamellas(): CutPiece[] {
  const params = {
    ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
    beamProfileId: 'pa1429',
    wallProfileId: 'f10040' as const,
    wallBeamWidthVersion: 1 as const,
    measuredOuterLengthMmByEdgeIndex: OUTERS,
    lamellaDirectionDeg: 0,
    purlinMaxSpanMm: 4000,
  }
  const axis = axisLengthsFromOuterLengthsMm({
    outerLengthsMm: OUTERS,
    angleDeg: ANGLES,
    defaultBeamPlanWidthMm: 70,
    planWidthForEdge: (edgeIndex) => contourSideWidthMm(PERGOLA_CONSTRUCTION_PROFILES, edgeIndex, {
      wallEdgeIndices: WALLS,
      beamProfileId: 'pa1429',
      wallProfileId: 'f10040',
      wallBeamWidthVersion: 1,
    }),
  })
  const pieces = buildPiecesFromPlan(
    { contour: contourFrom(axis, ANGLES), wallEdgeIndices: WALLS, params },
    PERGOLA_CONSTRUCTION_PROFILES,
  ).pieces
  return pieces.filter((piece) => piece.role === 'lamella')
}

describe('lamella bars are 6000 mm only', () => {
  it('keeps 70×20/0.8 and 40×20/0.9 on a single 6000 mm bar', () => {
    const thin = PERGOLA_CONSTRUCTION_PROFILES.get(LAMELLA_70_08_ID)
    const narrow = PERGOLA_CONSTRUCTION_PROFILES.get(LAMELLA_40_09_ID)
    expect(thin?.availableStockLengthsMm).toEqual([6000])
    expect(thin?.wallThicknessMm).toBe(0.8)
    expect(thin?.weightKgPerMeter).toBe(0.411)
    expect(narrow?.availableStockLengthsMm).toEqual([6000])
    expect(narrow?.wallThicknessMm).toBe(0.9)
    expect(narrow?.weightKgPerMeter).toBe(0.305)
    const thick = PERGOLA_CONSTRUCTION_PROFILES.get('pa 1121')
    expect(thick?.availableStockLengthsMm).toEqual([6000, 6500, 7000])
  })

  it('checks closed-tube weight against the catalog without replacing it', () => {
    const tube70 = hollowRectWeightKgPerM(70, 20, 0.8)
    const tube40 = hollowRectWeightKgPerM(40, 20, 0.9)
    expect(tube70).toBeCloseTo(0.3819, 3)
    expect(tube40).toBeCloseTo(0.2829, 3)
    expect(Math.abs((tube70 ?? 0) - 0.411)).toBeLessThan(0.04)
    expect(Math.abs((tube40 ?? 0) - 0.305)).toBeLessThan(0.03)
  })

  it('packs the 10000 plan into 6000 mm bars and records the old 7000 mm order', () => {
    const lamellas = wallLLamellas()
    expect(lamellas).toHaveLength(473)
    const wide = lamellas.filter((piece) => Math.abs(piece.lengthLongMm - 1359.3) < 0.6)
    const narrow = lamellas.filter((piece) => Math.abs(piece.lengthLongMm - 632.1) < 0.6)
    expect(wide).toHaveLength(430)
    expect(narrow).toHaveLength(43)

    const before = packProfile(lamellas, 7000, DEFAULT_KERF_MM)
    const after = packProfile(lamellas, 6000, DEFAULT_KERF_MM)
    expect(before.totalBars).toBe(91)
    expect(after.stockLengthMm).toBe(6000)
    expect(after.bars.some((bar) => bar.pieces.length > 1)).toBe(true)
    const kgPerM = PERGOLA_CONSTRUCTION_PROFILES.get(LAMELLA_70_08_ID)?.weightKgPerMeter ?? 0
    expect(before.totalBars * 7 * kgPerM).toBeCloseTo(261.807, 2)
    const packed = after.bars.reduce((sum, bar) => sum + bar.pieces.length, 0)
    expect(packed).toBe(473)
    expect(after.totalBars).toBe(112)
    expect(Math.round(after.totalWasteMm)).toBe(57960)
    expect(CONSTRUCTION_PURLIN_IDS).not.toContain('purlin-led-6040')
    expect(CONSTRUCTION_PURLIN_IDS).not.toContain('purlin-plain-5030')
    expect(CONSTRUCTION_PURLIN_IDS).toContain('F4060')
    expect(CONSTRUCTION_PURLIN_IDS).toContain('PA1296')
    expect(isRetiredProfileId('purlin-plain-5030')).toBe(true)
    expect(CONSTRUCTION_PURLIN_IDS).toContain('PA3022')
    expect(CONSTRUCTION_PURLIN_IDS).toContain('pa2005')
    expect(isRetiredProfileId('purlin-led-6040')).toBe(true)
    expect(PERGOLA_CONSTRUCTION_PROFILES.has('purlin-led-6040')).toBe(true)
  })
})
