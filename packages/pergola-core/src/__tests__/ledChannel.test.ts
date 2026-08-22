import { describe, it, expect } from 'vitest'
import { computeLedStripLengthMm, ledPurlinPieces } from '../ledChannel'
import type { CutPiece, ProfileDimensions } from '../types'

function purlinPiece(overrides: Partial<CutPiece> = {}): CutPiece {
  return {
    id: 'purlin-0',
    role: 'purlin',
    profileId: 'purlin-led',
    lengthAxisMm: 3000,
    lengthLongMm: 3000,
    lengthShortMm: 3000,
    cutMiterStartDeg: 0,
    cutBevelStartDeg: 0,
    cutHandStart: 'straight',
    cutMiterEndDeg: 0,
    cutBevelEndDeg: 0,
    cutHandEnd: 'straight',
    position: [0, 2600, 0],
    rotation: [0, 0, 0],
    color: '#9aa0a6',
    ...overrides,
  }
}

const LED_PROFILE: ProfileDimensions = { widthMm: 60, heightMm: 40, hasLedChannel: true }
const PLAIN_PROFILE: ProfileDimensions = { widthMm: 60, heightMm: 40 }

describe('computeLedStripLengthMm', () => {
  it('sums lengthLongMm of purlin pieces cut from an hasLedChannel profile', () => {
    const profiles = new Map([['purlin-led', LED_PROFILE]])
    const pieces = [
      purlinPiece({ id: 'p0', lengthLongMm: 3000 }),
      purlinPiece({ id: 'p1', lengthLongMm: 4500 }),
    ]
    expect(computeLedStripLengthMm(pieces, profiles)).toBeCloseTo(7500, 6)
  })

  it('ignores purlin pieces cut from a profile without hasLedChannel', () => {
    const profiles = new Map([['purlin-plain', PLAIN_PROFILE]])
    const pieces = [purlinPiece({ profileId: 'purlin-plain', lengthLongMm: 3000 })]
    expect(computeLedStripLengthMm(pieces, profiles)).toBe(0)
  })

  it('ignores non-purlin pieces even if their profile has hasLedChannel (e.g. a beam sharing a profileId by mistake)', () => {
    const profiles = new Map([['purlin-led', LED_PROFILE]])
    const pieces = [purlinPiece({ role: 'beam', profileId: 'purlin-led', lengthLongMm: 5000 })]
    expect(computeLedStripLengthMm(pieces, profiles)).toBe(0)
  })

  it('ignores pieces whose profileId is missing from the map, without throwing', () => {
    const profiles = new Map<string, ProfileDimensions>()
    const pieces = [purlinPiece({ profileId: 'unknown' })]
    expect(() => computeLedStripLengthMm(pieces, profiles)).not.toThrow()
    expect(computeLedStripLengthMm(pieces, profiles)).toBe(0)
  })

  it('returns 0 for an empty piece list', () => {
    expect(computeLedStripLengthMm([], new Map())).toBe(0)
  })

  it('mixed run: only LED-profile purlins count, beams/posts/plain purlins excluded', () => {
    const profiles = new Map([
      ['purlin-led', LED_PROFILE],
      ['purlin-plain', PLAIN_PROFILE],
    ])
    const pieces: CutPiece[] = [
      purlinPiece({ id: 'p0', profileId: 'purlin-led', lengthLongMm: 3000 }),
      purlinPiece({ id: 'p1', profileId: 'purlin-plain', lengthLongMm: 3000 }),
      purlinPiece({ id: 'b0', role: 'beam', profileId: 'purlin-led', lengthLongMm: 6000 }),
      purlinPiece({ id: 'post0', role: 'post', profileId: 'purlin-led', lengthLongMm: 2600 }),
    ]
    expect(computeLedStripLengthMm(pieces, profiles)).toBe(3000)
  })
})

describe('ledPurlinPieces', () => {
  it('returns only purlin pieces whose profile has hasLedChannel === true, preserving order', () => {
    const profiles = new Map([
      ['purlin-led', LED_PROFILE],
      ['purlin-plain', PLAIN_PROFILE],
    ])
    const led0 = purlinPiece({ id: 'led0', profileId: 'purlin-led' })
    const plain0 = purlinPiece({ id: 'plain0', profileId: 'purlin-plain' })
    const led1 = purlinPiece({ id: 'led1', profileId: 'purlin-led' })
    expect(ledPurlinPieces([led0, plain0, led1], profiles).map((p) => p.id)).toEqual(['led0', 'led1'])
  })

  it('returns [] when nothing qualifies', () => {
    const profiles = new Map([['purlin-plain', PLAIN_PROFILE]])
    expect(ledPurlinPieces([purlinPiece({ profileId: 'purlin-plain' })], profiles)).toEqual([])
  })
})
