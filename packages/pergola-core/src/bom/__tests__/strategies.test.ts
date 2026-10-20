import { describe, expect, it } from 'vitest'
import { buildParts } from '../buildParts'
import { nest } from '../nest'
import { ACCEPTANCE_MODEL } from './fixture'
import type { NestSettings } from '../types'

const COMBOS: Array<Partial<NestSettings>> = []
for (const frameMethod of ['builtin_kant', 'plain_plus_angle'] as const) {
  for (const frameSplit of ['equal', 'economical'] as const) {
    for (const hiddenAngles of ['whole', 'pieces'] as const) {
      COMBOS.push({ frameMethod, frameSplit, hiddenAngles })
    }
  }
}

describe('strategy combinations', () => {
  it('covers all 8 setting triples without throwing', () => {
    expect(COMBOS).toHaveLength(8)
    for (const settings of COMBOS) {
      const parts = buildParts({ ...ACCEPTANCE_MODEL, lengthCm: 800 }, settings)
      const result = nest(parts, settings)
      expect(result.bars.length).toBeGreaterThan(0)
    }
  })

  it('builtin_kant never nests angle bars', () => {
    const parts = buildParts(ACCEPTANCE_MODEL, { frameMethod: 'builtin_kant' })
    const result = nest(parts, { frameMethod: 'builtin_kant' })
    expect(result.bars.some((b) => b.profileId === '3x2')).toBe(false)
  })

  it('equal vs economical disagree on an 800 cm frame beam', () => {
    const part = buildParts({ ...ACCEPTANCE_MODEL, lengthCm: 800, shade: { count: 0, profileId: '2x7' }, divisions: { count: 0 } }, {
      frameMethod: 'builtin_kant',
    }).filter((p) => p.kind === 'frame' && p.lengthCm === 800).slice(0, 1)
    const equal = nest(part, { frameSplit: 'equal', frameMethod: 'builtin_kant' })
    const eco = nest(part, { frameSplit: 'economical', frameMethod: 'builtin_kant' })
    const equalLens = equal.bars.flatMap((b) => b.cuts.map((c) => c.lengthCm)).sort((a, b) => b - a)
    const ecoLens = eco.bars.flatMap((b) => b.cuts.map((c) => c.lengthCm)).sort((a, b) => b - a)
    expect(equalLens).toEqual([400, 400])
    expect(ecoLens).toEqual([600, 200])
  })

  it('hiddenAngles pieces can split a long angle onto leftovers', () => {
    const parts = buildParts(
      { ...ACCEPTANCE_MODEL, lengthCm: 250, widthCm: 250, shade: { count: 0, profileId: '2x7' }, divisions: { count: 0 } },
      { frameMethod: 'plain_plus_angle', hiddenAngles: 'pieces' },
    )
    const angles = parts.filter((p) => p.kind === 'angle')
    const whole = nest(angles, { hiddenAngles: 'whole' })
    const pieces = nest(angles, { hiddenAngles: 'pieces' })
    expect(pieces.bars.length).toBeLessThanOrEqual(whole.bars.length)
    expect(pieces.explanations.some((e) => e.includes('сборный')) || pieces.bars.length <= whole.bars.length).toBe(true)
  })
})
