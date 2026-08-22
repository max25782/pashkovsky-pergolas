import { describe, it, expect } from 'vitest'
import { splitContinuousRunMm, packPiecesIntoBars, compareStockLengthOptions } from '../stockLength'

describe('splitContinuousRunMm', () => {
  it('run shorter than stock → single piece, unchanged', () => {
    expect(splitContinuousRunMm(4000, 6000)).toEqual([4000])
  })

  it('run exactly equal to stock → single piece', () => {
    expect(splitContinuousRunMm(6000, 6000)).toEqual([6000])
  })

  it('run longer than stock → full-length pieces + remainder, no deduction', () => {
    // 8000mm lamella, 6000mm stock → one full 6000 + one 2000 remainder.
    // No connector/kerf allowance subtracted — full stock length per piece.
    expect(splitContinuousRunMm(8000, 6000)).toEqual([6000, 2000])
  })

  it('run exactly 2× stock → two full pieces', () => {
    expect(splitContinuousRunMm(12000, 6000)).toEqual([6000, 6000])
  })

  it('run just over 2× stock → three pieces (two full + short remainder)', () => {
    expect(splitContinuousRunMm(12500, 6000)).toEqual([6000, 6000, 500])
  })

  it('non-positive stock length throws', () => {
    expect(() => splitContinuousRunMm(1000, 0)).toThrow()
    expect(() => splitContinuousRunMm(1000, -100)).toThrow()
  })

  it('zero/negative run → []', () => {
    expect(splitContinuousRunMm(0, 6000)).toEqual([])
    expect(splitContinuousRunMm(-5, 6000)).toEqual([])
  })
})

describe('packPiecesIntoBars', () => {
  it('pieces that all fit in one bar → one bar', () => {
    const bars = packPiecesIntoBars([1000, 2000, 1500], 6000)
    expect(bars).toHaveLength(1)
    expect(bars[0].piecesMm.sort((a, b) => b - a)).toEqual([2000, 1500, 1000])
  })

  it('overflow spills into a second bar', () => {
    const bars = packPiecesIntoBars([4000, 4000], 6000)
    expect(bars).toHaveLength(2)
  })

  it('kerf is charged per piece placed', () => {
    // Two 3000mm pieces in a 6000mm bar with 10mm kerf each → 6020mm needed,
    // doesn't fit in one bar → two bars.
    const bars = packPiecesIntoBars([3000, 3000], 6000, 10)
    expect(bars).toHaveLength(2)
  })

  it('longest-first packing uses no more bars than arrival-order first-fit', () => {
    // Classic case where naive first-fit (in this order) wastes a bar:
    // [3000, 3000, 4000, 2000] stock=6000 → arrival-order first-fit gets
    // 3000+3000=6000 (bar1), 4000 (bar2), 2000 fits after 4000 (bar2) → 2 bars.
    // Sorted-desc: 4000(bar1), 3000(bar2), 3000+2000=5000(bar2) → also 2 bars
    // here, but the KEY property under test is "no worse", not "always better".
    const bars = packPiecesIntoBars([3000, 3000, 4000, 2000], 6000)
    expect(bars.length).toBeLessThanOrEqual(2)
  })
})

describe('compareStockLengthOptions', () => {
  it('uses lengthLongMm, not axis length — long-point drives ordering', () => {
    const pieces = [{ lengthLongMm: 6100 }] // just over 6m — must NOT fit in a single 6000mm bar
    const result = compareStockLengthOptions(pieces, [6000, 7000])
    const opt6000 = result.options.find(o => o.stockLengthMm === 6000)!
    const opt7000 = result.options.find(o => o.stockLengthMm === 7000)!
    expect(opt6000.barsUsed).toBe(2) // split into 6000 + 100
    expect(opt7000.barsUsed).toBe(1)
  })

  it('picks the stock length using fewest bars as bestStockLengthMm', () => {
    const pieces = [{ lengthLongMm: 6100 }]
    const result = compareStockLengthOptions(pieces, [6000, 7000])
    expect(result.bestStockLengthMm).toBe(7000)
  })

  it('ties on bars → tie-broken by least waste', () => {
    // A single 5000mm piece fits in either a 6000 or 7000mm bar with 1 bar
    // each — 6000mm wastes less (1000mm vs 2000mm) and must win the tie.
    const pieces = [{ lengthLongMm: 5000 }]
    const result = compareStockLengthOptions(pieces, [6000, 7000])
    expect(result.options.every(o => o.barsUsed === 1)).toBe(true)
    expect(result.bestStockLengthMm).toBe(6000)
  })

  it('empty availableStockLengthsMm → no options, bestStockLengthMm null', () => {
    const result = compareStockLengthOptions([{ lengthLongMm: 1000 }], [])
    expect(result.options).toEqual([])
    expect(result.bestStockLengthMm).toBeNull()
  })

  it('reports 0% waste for pieces that exactly fill whole bars', () => {
    const pieces = [{ lengthLongMm: 3000 }, { lengthLongMm: 3000 }]
    const result = compareStockLengthOptions(pieces, [6000])
    expect(result.options[0].barsUsed).toBe(1)
    expect(result.options[0].wasteMm).toBe(0)
    expect(result.options[0].wastePercent).toBe(0)
  })
})
