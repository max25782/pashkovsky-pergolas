import { describe, expect, it } from 'vitest'
import { BOM_PROFILE_CATALOG } from '../catalog'
import { buildBom } from '../buildBom'
import { ACCEPTANCE_MODEL } from './fixture'

describe('buildBom', () => {
  it('reports aluminum as purchased-bar weight and used-from-stock meters', () => {
    const bom = buildBom(ACCEPTANCE_MODEL)
    const frame = bom.aluminum.find((l) => l.profileId === '12x4')!
    expect(frame.bars).toBe(7)
    expect(frame.stockMeters).toBe(42)
    expect(frame.usedMeters).toBeCloseTo((600 + 600 + 400 + 400 + 392 + 392 + 392) / 100, 8)
    expect(frame.weightKg).toBeCloseTo(42 * BOM_PROFILE_CATALOG['12x4'].weightKgPerM, 8)
    expect(frame.usagePct).toBeCloseTo((frame.usedMeters / frame.stockMeters) * 100, 8)
  })

  it('prices aluminum ₪/kg × purchased-bar weight and fasteners by piece', () => {
    const bom = buildBom(ACCEPTANCE_MODEL, undefined, undefined, {
      aluminumIlsPerKg: 20,
      fastenerIlsPerUnit: { shade_screws: 1, construction_screws: 1, angle_screws: 1 },
    })
    expect(bom.totals.aluminumCostIls).toBeCloseTo(bom.totals.weightKg * 20, 6)
    const fastenerQty = bom.fasteners.reduce((s, l) => s + l.total, 0)
    expect(bom.totals.fastenerCostIls).toBe(fastenerQty)
    expect(bom.totals.totalCostIls).toBeCloseTo((bom.totals.aluminumCostIls ?? 0) + fastenerQty, 6)
  })

  it('omits cost fields when prices are not given', () => {
    const bom = buildBom(ACCEPTANCE_MODEL)
    expect(bom.totals.aluminumCostIls).toBeUndefined()
    expect(bom.totals.fastenerCostIls).toBeUndefined()
    expect(bom.totals.totalCostIls).toBeUndefined()
  })

  it('lists hardware separately from fasteners', () => {
    const bom = buildBom({
      ...ACCEPTANCE_MODEL,
      posts: { count: 4, profileId: '12x4', lengthCm: 250 },
    })
    expect(bom.hardware).toHaveLength(4)
    expect(bom.fasteners).toHaveLength(3)
  })

  it('exposes warnings[] (empty by default; passthrough when given)', () => {
    const unmarked = buildBom(ACCEPTANCE_MODEL)
    expect(unmarked.warnings).toEqual([])
    const marked = buildBom(ACCEPTANCE_MODEL, undefined, undefined, undefined, {
      warnings: [{
        type: 'lamella-span-exceeds-max',
        message: 'span',
        pieceId: 'lam-0',
        profileId: 'lam-1',
        spanMm: 4000,
        maxSpanMm: 1500,
        startDividerId: null,
        endDividerId: 'a',
        spanStartMm: 0,
        spanEndMm: 4000,
      }],
    })
    expect(marked.warnings).toHaveLength(1)
    expect(marked.parts.filter((p) => p.kind === 'division').map((d) => d.lengthCm)).toEqual([392, 392, 392])
  })
})
