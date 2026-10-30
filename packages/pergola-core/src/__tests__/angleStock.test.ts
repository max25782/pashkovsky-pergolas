import { describe, expect, it } from 'vitest'
import { ANGLE_30_PROFILE_ID, angleLengthMm, angleProfileDimensions, buildAngleCutPieces } from '../angleStock'
import { barPackLowerBound, packProfile } from '../packProfile'

describe('30×30 angle stock', () => {
  it('cuts two pieces of H per section and packs them on 6 m bars', () => {
    const sections = [
      { id: 'a', heightMm: 2453 },
      { id: 'b', heightMm: 1412 },
    ]
    expect(angleLengthMm(sections[0])).toBe(2453)
    const pieces = buildAngleCutPieces(sections, '#9aa0a6')
    expect(pieces).toHaveLength(4)
    expect(pieces.every((piece) => piece.profileId === ANGLE_30_PROFILE_ID)).toBe(true)
    expect(pieces.every((piece) => piece.cutMiterStartDeg === 0 && piece.cutMiterEndDeg === 0)).toBe(true)
    const profile = angleProfileDimensions()
    expect(profile.availableStockLengthsMm).toEqual([6000])
    expect(profile.weightKgPerMeter).toBeCloseTo(0.353, 3)
    expect(profile.widthMm).toBe(30)
    const plan = packProfile(pieces, 6000, 5)
    const slots = pieces.map((piece) => piece.lengthLongMm + 5)
    expect(plan.totalBars).toBeGreaterThanOrEqual(barPackLowerBound(slots, 6000))
    expect(plan.bars.reduce((sum, bar) => sum + bar.pieces.length, 0)).toBe(4)
  })
})
