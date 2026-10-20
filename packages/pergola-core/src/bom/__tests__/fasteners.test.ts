import { describe, expect, it } from 'vitest'
import { buildParts } from '../buildParts'
import { fasteners } from '../fasteners'
import { DEFAULT_FASTENER_RULES } from '../defaults'
import { ACCEPTANCE_MODEL } from './fixture'

describe('fasteners', () => {
  it('is driven by the rules array, not hard-coded ids', () => {
    const parts = buildParts(ACCEPTANCE_MODEL)
    const onlyShade = fasteners(ACCEPTANCE_MODEL, parts, [DEFAULT_FASTENER_RULES[0]])
    expect(onlyShade).toHaveLength(1)
    expect(onlyShade[0].id).toBe('shade_screws')
  })

  it('applies spare_pct with ceil', () => {
    const parts = buildParts(ACCEPTANCE_MODEL)
    const [line] = fasteners(ACCEPTANCE_MODEL, parts, [
      { ...DEFAULT_FASTENER_RULES[0], sparePct: 0 },
    ])
    expect(line.quantity).toBe(220)
    expect(line.total).toBe(220)
  })

  it('uses rule coefficients for construction (40 under defaults)', () => {
    const parts = buildParts(ACCEPTANCE_MODEL)
    const [line] = fasteners(ACCEPTANCE_MODEL, parts, [
      {
        id: 'construction_screws',
        name: 'x',
        kind: 'construction_screws',
        sparePct: 5,
        unit: 'шт',
        screwsPerDivisionEnd: 2,
        screwsPerFrameCorner: 4,
        screwsPerHanger: 3,
        hangerCount: 4,
      },
    ])
    expect(line.quantity).toBe(40)
    expect(line.total).toBe(42)
  })

  it('counts angle screws as floor(L/40)+1 including both ends', () => {
    const parts = buildParts(ACCEPTANCE_MODEL)
    const [line] = fasteners(ACCEPTANCE_MODEL, parts, [DEFAULT_FASTENER_RULES[2]])
    expect(line.quantity).toBe(16 + 16 + 11 + 11)
  })

  it('attaches optional unit price and line cost', () => {
    const parts = buildParts(ACCEPTANCE_MODEL)
    const [line] = fasteners(ACCEPTANCE_MODEL, parts, [
      { ...DEFAULT_FASTENER_RULES[0], pricePerUnit: 0.5 },
    ])
    expect(line.costIls).toBe(231 * 0.5)
  })
})
