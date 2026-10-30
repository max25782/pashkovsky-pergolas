import { describe, expect, it } from 'vitest'
import {
  ANGLE_30_PROFILE_ID,
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  PERGOLA_CONSTRUCTION_PROFILES,
  WING_SHELF_SPAN_DIVIDER_ID,
  angleLengthMm,
  buildAngleCutPieces,
  buildLamellaSections,
  buildPiecesFromPlan,
  computeFrame,
  specFromPlan,
} from '../index'
import { pieceAxis } from '../pieceAxis'
import { collectFrameBeamTrimSegments } from '../dividerFrameTrim'

/** L 12 m. Polygon vertices are beam centerlines; typed outers are 40 mm longer on the outer sides. */
const LIVE_L: [number, number][] = [
  [0, 0],
  [4000, 0],
  [4000, 3000],
  [11960, 3000],
  [11960, 6460],
  [0, 6460],
]
const MEASURED = [4000, 3000, 8000, 3500, 12000, 6500]

const params = {
  ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  measuredOuterLengthMmByEdgeIndex: MEASURED,
  purlinMaxSpanMm: 4000,
  purlinProfileId: 'PA3022',
  beamProfileId: 'R242',
  wallProfileId: 'pa1162',
  wingShelfProfileId: 'pa1162',
  lamellaDirectionDeg: 0,
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

describe('L 12 m left purlins on R242 with the pa1162 shelf', () => {
  const spec = specFromPlan({ contour: LIVE_L, wallEdgeIndices: [], params })
  const built = buildPiecesFromPlan(
    { contour: LIVE_L, wallEdgeIndices: [], params },
    PERGOLA_CONSTRUCTION_PROFILES,
  )
  const purlins = built.pieces.filter(
    (piece) => piece.role === 'purlin' && piece.dividerId !== WING_SHELF_SPAN_DIVIDER_ID,
  )

  it('meets the shelf on the left wing and the drawn R242 face on the right', () => {
    const rows = purlins.map((piece) => {
      const axis = pieceAxis(piece)
      const y0 = Math.min(axis.start[1], axis.end[1])
      const y1 = Math.max(axis.start[1], axis.end[1])
      const x = (axis.start[0] + axis.end[0]) / 2
      return { x, y0: round1(y0), y1: round1(y1), len: round1(piece.lengthAxisMm) }
    })

    const shelf = built.pieces.find((piece) => piece.dividerId === WING_SHELF_SPAN_DIVIDER_ID)
    expect(shelf).toBeDefined()
    const shelfAxis = pieceAxis(shelf!)
    const shelfY = (shelfAxis.start[1] + shelfAxis.end[1]) / 2
    // pa1162 stays on the notch axis y=3000. Faces are 2980 and 3020.
    expect(shelfY).toBeCloseTo(3000, 0)
    expect(shelf!.lengthAxisMm).toBeCloseTo(3860, 0)
    const shelfTop = shelfY + 20
    const shelfBottom = shelfY - 20

    const notchBeamTop = 3000 + 35
    const topBeamInner = 6460 - 35
    const bottomBeamInner = 0 + 35

    const leftUpper = rows.filter((row) => Math.abs(row.y0 - shelfTop) < 1)
    const leftLower = rows.filter((row) => Math.abs(row.y1 - shelfBottom) < 1)
    const right = rows.filter((row) => Math.abs(row.y0 - notchBeamTop) < 1 && row.y0 > 3000)
    expect(leftUpper.length).toBeGreaterThan(0)
    expect(leftLower.length).toBeGreaterThan(0)
    expect(right.length).toBeGreaterThan(0)
    expect(leftUpper.length + leftLower.length + right.length).toBe(rows.length)

    for (const row of leftUpper) {
      expect(row.y0).toBeCloseTo(shelfTop, 0)
      expect(row.y1).toBeCloseTo(topBeamInner, 0)
      expect(row.len).toBeCloseTo(3405, 0)
      expect(row.y0 - shelfTop).toBeCloseTo(0, 0)
    }
    for (const row of leftLower) {
      expect(row.y0).toBeCloseTo(bottomBeamInner, 0)
      expect(row.y1).toBeCloseTo(shelfBottom, 0)
      expect(row.len).toBeCloseTo(2945, 0)
      expect(shelfBottom - row.y1).toBeCloseTo(0, 0)
    }
    for (const row of right) {
      expect(row.y0).toBeCloseTo(notchBeamTop, 0)
      expect(row.y1).toBeCloseTo(topBeamInner, 0)
      expect(row.len).toBeCloseTo(3390, 0)
      expect(row.y0 - notchBeamTop).toBeCloseTo(0, 0)
    }
  })

  it('section height is the purlin length minus 30, and the angle equals that height', () => {
    const sections = buildLamellaSections(spec, PERGOLA_CONSTRUCTION_PROFILES)
    const upperLeft = sections.filter((section) => Math.abs(section.clearHMm - 3405) < 1)
    const upperRight = sections.filter((section) => Math.abs(section.clearHMm - 3390) < 1)
    const lower = sections.filter((section) => Math.abs(section.clearHMm - 2945) < 1)
    expect(upperLeft.length).toBeGreaterThan(0)
    expect(upperRight.length).toBeGreaterThan(0)
    expect(lower.length).toBeGreaterThan(0)
    expect(upperLeft.length + upperRight.length + lower.length).toBe(sections.length)

    for (const section of sections) {
      expect(section.heightMm).toBeCloseTo(section.clearHMm - 30, 0)
    }

    const angles = buildAngleCutPieces(sections, params.colorHex)
    expect(angles.length).toBe(sections.length * 2)
    for (const section of sections) {
      const pair = angles.filter((piece) => piece.id.startsWith(`${section.id}-angle-`))
      expect(pair).toHaveLength(2)
      for (const piece of pair) {
        expect(piece.profileId).toBe(ANGLE_30_PROFILE_ID)
        expect(piece.lengthAxisMm).toBeCloseTo(angleLengthMm(section), 5)
        expect(piece.lengthAxisMm).toBeCloseTo(section.heightMm, 5)
      }
    }
  })

  it('each purlin matches the inner-face span, sits 30 mm above its section, and stays out of the beams', () => {
    const frame = computeFrame(spec, PERGOLA_CONSTRUCTION_PROFILES)
    const beams = collectFrameBeamTrimSegments(frame.beams, PERGOLA_CONSTRUCTION_PROFILES)
    const sections = buildLamellaSections(spec, PERGOLA_CONSTRUCTION_PROFILES)

    for (const piece of purlins) {
      const axis = pieceAxis(piece)
      const y0 = Math.min(axis.start[1], axis.end[1])
      const y1 = Math.max(axis.start[1], axis.end[1])
      const x = (axis.start[0] + axis.end[0]) / 2
      const hosts = sections.filter((section) => {
        const pad = (section.clearHMm - section.heightMm) / 2
        const cellMinY = section.minY - pad
        const cellMaxY = section.maxY + pad
        return (
          Math.abs(cellMinY - y0) < 2 &&
          Math.abs(cellMaxY - y1) < 2 &&
          x >= section.minX - 40 &&
          x <= section.maxX + 40
        )
      })
      expect(hosts.length).toBeGreaterThan(0)
      for (const host of hosts) {
        expect(piece.lengthAxisMm - host.heightMm).toBeCloseTo(30, 0)
      }

      for (const beam of beams) {
        const by0 = Math.min(beam.start[1], beam.end[1])
        const by1 = Math.max(beam.start[1], beam.end[1])
        if (Math.abs(by1 - by0) > 2) continue
        const beamY = (by0 + by1) / 2
        const x0 = Math.min(beam.start[0], beam.end[0])
        const x1 = Math.max(beam.start[0], beam.end[0])
        if (x < x0 - 1 || x > x1 + 1) continue
        const overlaps = y1 > beamY - beam.halfWidthMm + 0.5 && y0 < beamY + beam.halfWidthMm - 0.5
        expect(overlaps).toBe(false)
      }
    }
  })
})
