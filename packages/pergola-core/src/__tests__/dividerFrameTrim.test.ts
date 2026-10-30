import { describe, expect, it } from 'vitest'
import type { Point2D } from '../types'
import { buildPiecesFromPlan } from '../buildPieces'
import { computeWingShelfClearSpan } from '../dividerFrameTrim'
import { buildPlanEditorOverlayModel, findWingShelfSpanSegment, WING_SHELF_SPAN_DIVIDER_ID } from '../planEditorDimensions'
import { computeFrame } from '../frame'
import { computePurlins } from '../purlins'
import { pieceAxis } from '../pieceAxis'
import { DEFAULT_PLAN_CONSTRUCTION_PARAMS } from '../planDefaults'
import { PERGOLA_CONSTRUCTION_PROFILES } from '../pergolaProfiles'
import { specFromPlan } from '../buildPieces'
import { packProfile } from '../packProfile'

const G_SLOPE_FIXTURE: Point2D[] = [
  [0, 0],
  [0, 9996],
  [13002, 9996],
  [13002, 4622],
]

function wobbleContour(contour: Point2D[], tiltDeg: number): Point2D[] {
  const tiltRad = (tiltDeg * Math.PI) / 180
  return contour.map((p) => [p[0] + Math.sin(tiltRad) * p[1] * 0.001, p[1]])
}

describe('dividerFrameTrim — G-shape wing shelf', () => {
  const contour = [...G_SLOPE_FIXTURE]
  const params = { ...DEFAULT_PLAN_CONSTRUCTION_PARAMS, lamellaDirectionDeg: 90 }
  const profiles = PERGOLA_CONSTRUCTION_PROFILES
  const spec = specFromPlan({ contour, wallEdgeIndices: [], params })
  const frame = computeFrame(spec, profiles)

  it('wing shelf clear span = inner face to inner face at notch (report length)', () => {
    const shelf = findWingShelfSpanSegment(contour)
    expect(shelf).not.toBeNull()
    const clear = computeWingShelfClearSpan(shelf!, frame.beams, profiles)
    expect(clear.lengthMm).toBeCloseTo(12962, 0)
    expect(clear.start[0]).toBeCloseTo(20, 0)
    expect(clear.end[0]).toBeCloseTo(12982, 0)
  })

  it('overlay wing-shelf line does not extend along outer shelf beam to xmax', () => {
    const model = buildPlanEditorOverlayModel({
      contour,
      wallEdgeIndices: [],
      params,
      profiles,
    })
    const wing = model!.dividerLines.find((l) => l.dividerId === WING_SHELF_SPAN_DIVIDER_ID)
    expect(wing).toBeDefined()
    const span = Math.hypot(wing!.end[0] - wing!.start[0], wing!.end[1] - wing!.start[1])
    expect(span).toBeCloseTo(12962, 0)
    expect(span).toBeLessThan(13002)
  })

  it('total purlin axis length excludes a full 13002 mm shelf-on-beam segment', () => {
    const purlins = computePurlins(spec, profiles, undefined, { frameBeams: frame.beams })
    const sum = purlins.reduce((s, p) => s + p.lengthAxisMm, 0)
    expect(sum).toBeLessThan(1_000_000)
    const fullOuterShelfBars = purlins.filter((p) => {
      const { start, end } = pieceAxis(p)
      const dy = Math.abs(end[1] - start[1])
      const len = Math.hypot(end[0] - start[0], end[1] - start[1])
      return dy < 2 && len > 12_990
    })
    expect(fullOuterShelfBars).toHaveLength(0)
  })

  it('nest pack: no purlin piece spans full outer shelf width (13002 mm)', () => {
    const built = buildPiecesFromPlan({ contour, wallEdgeIndices: [], params }, profiles)
    const stock =
      profiles.get(params.purlinProfileId)?.availableStockLengthsMm?.[0] ?? 6000
    const purlinPieces = built.pieces.filter((p) => p.profileId === params.purlinProfileId)
    const longestNeed = Math.max(...purlinPieces.map((p) => p.lengthLongMm)) + 20
    const packed = packProfile(
      purlinPieces,
      Math.max(stock, longestNeed),
      4,
    )
    expect(packed.bars.length).toBeGreaterThan(0)
    const longestPiece = Math.max(
      ...built.pieces.filter((p) => p.role === 'purlin').map((p) => p.lengthAxisMm),
    )
    expect(longestPiece).toBeLessThan(13_002)
  })

  it('0.1° wobble: same clear length and no long horizontal shelf purlin', () => {
    const wobble = wobbleContour(contour, 0.1)
    const wSpec = specFromPlan({ contour: wobble, wallEdgeIndices: [], params })
    const wFrame = computeFrame(wSpec, profiles)
    const shelf = findWingShelfSpanSegment(wobble)
    const clear = computeWingShelfClearSpan(shelf!, wFrame.beams, profiles)
    expect(clear.lengthMm).toBeCloseTo(12962, 0)
    const purlins = computePurlins(wSpec, profiles, undefined, { frameBeams: wFrame.beams })
    const horizFullShelf = purlins.filter((p) => {
      const { start, end } = pieceAxis(p)
      return Math.abs(end[1] - start[1]) < 5 && Math.hypot(end[0] - start[0], end[1] - start[1]) > 12_990
    })
    expect(horizFullShelf).toHaveLength(0)
  })
})

describe('dividerFrameTrim — rectangle div-N unchanged count', () => {
  it('auto dividers on 6×3 m still emit the same number of purlin pieces', () => {
    const contour: Point2D[] = [[0, 0], [6000, 0], [6000, 3000], [0, 3000]]
    const params = { ...DEFAULT_PLAN_CONSTRUCTION_PARAMS }
    const profiles = PERGOLA_CONSTRUCTION_PROFILES
    const spec = specFromPlan({ contour, wallEdgeIndices: [], params })
    const frame = computeFrame(spec, profiles)
    const purlins = computePurlins(spec, profiles, undefined, { frameBeams: frame.beams })
    expect(purlins.length).toBe(4)
    expect(purlins.every((p) => p.dividerId?.startsWith('div-'))).toBe(true)
  })
})
