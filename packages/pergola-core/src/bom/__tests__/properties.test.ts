import { describe, expect, it } from 'vitest'
import { buildParts, nestLengthCm } from '../buildParts'
import { barUsedCm, nest } from '../nest'
import { DEFAULT_KERF_CM, mergeNestSettings } from '../defaults'
import { ACCEPTANCE_MODEL } from './fixture'
import type { BomModel, BomPart, NestSettings } from '../types'

const STRATEGY_GRID: Array<Partial<NestSettings>> = []
for (const frameMethod of ['builtin_kant', 'plain_plus_angle'] as const) {
  for (const frameSplit of ['equal', 'economical'] as const) {
    for (const hiddenAngles of ['whole', 'pieces'] as const) {
      STRATEGY_GRID.push({ frameMethod, frameSplit, hiddenAngles })
    }
  }
}

function longModel(): BomModel {
  return { ...ACCEPTANCE_MODEL, lengthCm: 800, widthCm: 400 }
}

function assertNestInvariants(parts: BomPart[], settings?: Partial<NestSettings>): void {
  const cfg = mergeNestSettings(settings)
  const expected = parts.filter((p) => nestLengthCm(p) > 0)
  const result = nest(parts, cfg)
  const kerf = cfg.kerfCm

  for (const bar of result.bars) {
    expect(bar.remainderCm).toBeGreaterThanOrEqual(-1e-9)
    expect(barUsedCm(bar, kerf) + bar.remainderCm).toBeCloseTo(bar.stockLengthCm, 6)
  }

  const origins = result.bars.flatMap((b) => b.cuts.map((c) => c.originPartId))
  expect(new Set(origins).size).toBe(expected.length)
  expect(origins.length).toBeGreaterThanOrEqual(expected.length)

  for (const part of expected) {
    const placed = result.bars.flatMap((b) => b.cuts.filter((c) => c.originPartId === part.id))
    expect(placed.length).toBeGreaterThanOrEqual(1)
    const sum = placed.reduce((s, c) => s + c.lengthCm, 0)
    expect(sum).toBeCloseTo(nestLengthCm(part), 6)
  }
}

describe('nest properties', () => {
  it('acceptance parts: cuts + kerf + remainder = stock; no lost/dup origins', () => {
    assertNestInvariants(buildParts(ACCEPTANCE_MODEL))
  })

  it('holds for every strategy combination on a 800×400 model', () => {
    for (const settings of STRATEGY_GRID) {
      assertNestInvariants(buildParts(longModel(), settings), settings)
    }
  })

  it('never lists a negative remainder', () => {
    const result = nest(buildParts(ACCEPTANCE_MODEL))
    expect(result.bars.every((b) => b.remainderCm >= 0)).toBe(true)
  })

  it('uses the configured kerf (not a silent 0)', () => {
    const parts = [
      { id: 'a', kind: 'division' as const, profileId: '12x4', color: 'x', lengthCm: 200 },
      { id: 'b', kind: 'division' as const, profileId: '12x4', color: 'x', lengthCm: 200 },
    ]
    const withKerf = nest(parts, { kerfCm: DEFAULT_KERF_CM })
    const noKerf = nest(parts, { kerfCm: 0 })
    expect(withKerf.bars).toHaveLength(1)
    expect(noKerf.bars).toHaveLength(1)
    expect(withKerf.bars[0].remainderCm).toBeCloseTo(noKerf.bars[0].remainderCm - DEFAULT_KERF_CM, 8)
  })
})
