import { describe, expect, it } from 'vitest'
import { buildParts } from '../buildParts'
import { barUsedCm, nest, splitForStock } from '../nest'
import { DEFAULT_KERF_CM } from '../defaults'
import type { BomPart } from '../types'

function part(overrides: Partial<BomPart> & Pick<BomPart, 'id' | 'lengthCm'>): BomPart {
  return {
    kind: 'division',
    profileId: '12x4',
    color: 'anthracite',
    ...overrides,
  }
}

describe('splitForStock', () => {
  it('economical 800 / 600 → 600 + 200', () => {
    expect(splitForStock(800, 600, 'economical', 100)).toEqual([600, 200])
  })

  it('equal 800 / 600 → two 400s', () => {
    expect(splitForStock(800, 600, 'equal', 100)).toEqual([400, 400])
  })

  it('economical remainder shorter than minRemainder borrows from the last full bar', () => {
    expect(splitForStock(650, 600, 'economical', 100)).toEqual([550, 100])
  })

  it('leaves a short piece alone', () => {
    expect(splitForStock(400, 600, 'economical', 100)).toEqual([400])
  })
})

describe('nest', () => {
  it('is deterministic (FFD + stable id tie-break)', () => {
    const parts = [part({ id: 'b', lengthCm: 200 }), part({ id: 'a', lengthCm: 200 })]
    const a = nest(parts)
    const b = nest(parts)
    expect(a).toEqual(b)
  })

  it('charges kerf between pieces, not after a lone full-bar piece', () => {
    const two = nest([part({ id: 'p1', lengthCm: 200 }), part({ id: 'p2', lengthCm: 200 })])
    expect(two.bars).toHaveLength(1)
    expect(two.bars[0].remainderCm).toBeCloseTo(600 - 200 - 200 - DEFAULT_KERF_CM, 8)
    const full = nest([part({ id: 'full', lengthCm: 600, kind: 'shade', profileId: '2x7' })])
    expect(full.bars[0].remainderCm).toBe(0)
  })

  it('does not place a second 400 on a 600 bar (400+400+kerf > 600)', () => {
    const result = nest([part({ id: 'a', lengthCm: 400 }), part({ id: 'b', lengthCm: 400 })])
    expect(result.bars).toHaveLength(2)
  })

  it('explains an economical frame split', () => {
    const result = nest([
      {
        id: 'frame-long',
        kind: 'frame',
        profileId: '12x4',
        color: 'anthracite',
        lengthCm: 800,
        miterStartDeg: 45,
        miterEndDeg: 45,
        lengthLongCm: 800,
        lengthShortCm: 792,
      },
    ])
    expect(result.explanations.some((e) => e.includes('рамная балка 800 см: хлыст 600 + остаток 200'))).toBe(true)
    expect(result.bars).toHaveLength(2)
  })

  it('marks remainders ≥ 100 cm reusable', () => {
    const result = nest([part({ id: 'a', lengthCm: 400 })])
    expect(result.bars[0].remainderCm).toBeCloseTo(200, 8)
    expect(result.bars[0].reusable).toBe(true)
  })

  it('barUsedCm + remainder equals stock', () => {
    const result = nest([part({ id: 'a', lengthCm: 250 }), part({ id: 'b', lengthCm: 200 })])
    for (const bar of result.bars) {
      expect(barUsedCm(bar, DEFAULT_KERF_CM) + bar.remainderCm).toBeCloseTo(bar.stockLengthCm, 8)
    }
  })
})
