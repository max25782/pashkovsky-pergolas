import { describe, it, expect } from 'vitest'
import {
  HOUSE_CONTOUR_MM,
  HOUSE_EDGE_LABELS,
  HOUSE_FREE_EDGE_INDICES,
  houseMeasuredOuterLengthMm,
  houseSpecInput,
} from '../acceptance/houseContour'
import { buildPiecesFromPlan, specFromPlan } from '../buildPieces'
import { computeFrame } from '../frame'
import { PERGOLA_CONSTRUCTION_PROFILES } from '../pergolaProfiles'
import { segmentLongShortMm } from '../beamSegmentation'

/** Max house export: R242 free + pa1162 wall + div-5. */
function houseMaxInput() {
  const clear = (9495 - 70 - 70 - 6 * 40) / 7
  const lines = Array.from({ length: 6 }, (_, i) => {
    const k = i + 1
    return { id: `div-${k}`, positionMm: 70 + k * clear + (k - 1) * 40 + 20 }
  })
  return houseSpecInput(HOUSE_CONTOUR_MM, {
    lamellaDirectionDeg: 0,
    purlinMaxSpanMm: 4000,
    wingShelfProfileId: 'f10040',
    beamProfileId: 'R242',
    wallProfileId: 'pa1162',
    wallBeamWidthVersion: 1,
    purlinProfileId: 'PA3022',
    skewSectionVersion: 1,
    purlinDividers: { mode: 'manual', lines },
  })
}

describe('house outer-faces R242 cutlist', () => {
  it('frame longs equal outer chords on free edges (no half-width miter add)', () => {
    const input = houseMaxInput()
    expect(input.params.contourReference).toBe('outer-faces')
    const frame = computeFrame(specFromPlan(input), PERGOLA_CONSTRUCTION_PROFILES)
    const chords = houseMeasuredOuterLengthMm()
    for (const i of HOUSE_FREE_EDGE_INDICES) {
      const beam = frame.beams[i]
      expect(beam.profileId).toBe('R242')
      expect(Math.round(beam.lengthLongMm)).toBe(chords[i])
      expect(Math.round(beam.lengthAxisMm)).toBe(chords[i])
    }
  })

  it('stock-split free beams keep per-side long sum = chord (27735 total)', () => {
    const built = buildPiecesFromPlan(houseMaxInput(), PERGOLA_CONSTRUCTION_PROFILES)
    const chords = houseMeasuredOuterLengthMm()
    const free = built.pieces.filter((p) => p.role === 'beam' && p.profileId === 'R242')
    const byEdge = new Map<number, number>()
    for (const piece of free) {
      const m = /^beam-(\d+)/.exec(piece.id)
      expect(m).not.toBeNull()
      const idx = Number(m![1])
      byEdge.set(idx, (byEdge.get(idx) ?? 0) + piece.lengthLongMm)
    }
    let total = 0
    for (const i of HOUSE_FREE_EDGE_INDICES) {
      const sum = byEdge.get(i) ?? 0
      total += sum
      expect(Math.round(sum), HOUSE_EDGE_LABELS[i]).toBe(chords[i])
    }
    expect(Math.round(total)).toBe(27735)
  })

  it('wall sticks keep free-through trim (2680 / 2801), not outer-face inflation', () => {
    const built = buildPiecesFromPlan(houseMaxInput(), PERGOLA_CONSTRUCTION_PROFILES)
    const walls = built.pieces
      .filter((p) => p.role === 'beam' && p.profileId === 'pa1162')
      .map((p) => Math.round(p.lengthLongMm))
      .sort((a, b) => a - b)
    expect(walls).toEqual([2680, 2801, 2865, 3465])
  })

  it('segmentLongShortMm: outer parent (long≈axis) does not re-add δ; centerline does', () => {
    const outer = segmentLongShortMm({
      segAxisMm: 3000,
      deltaStartMm: 35,
      deltaEndMm: 0,
      parent: { lengthAxisMm: 7480, lengthLongMm: 7480 },
    })
    expect(outer.lengthLongMm).toBe(3000)

    const center = segmentLongShortMm({
      segAxisMm: 3000,
      deltaStartMm: 35,
      deltaEndMm: 0,
      parent: { lengthAxisMm: 7480, lengthLongMm: 7480 + 35 },
    })
    expect(center.lengthLongMm).toBe(3035)
  })

  it('f10040 / pa1162 house: beam long sum does not exceed outer perimeter', () => {
    const chords = houseMeasuredOuterLengthMm()
    const peri = chords.reduce((a, c) => a + c, 0)
    for (const id of ['f10040', 'pa1162'] as const) {
      const built = buildPiecesFromPlan(
        houseSpecInput(HOUSE_CONTOUR_MM, {
          beamProfileId: id,
          wallProfileId: id,
          wallBeamWidthVersion: 1,
        }),
        PERGOLA_CONSTRUCTION_PROFILES,
      )
      const sum = built.pieces
        .filter((p) => p.role === 'beam')
        .reduce((a, p) => a + p.lengthLongMm, 0)
      expect(sum, id).toBeLessThanOrEqual(peri + 1)
    }
  })
})
