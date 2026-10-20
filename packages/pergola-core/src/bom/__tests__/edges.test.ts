import { describe, expect, it } from 'vitest'
import { buildBom, buildParts, nest } from '../index'
import { ACCEPTANCE_MODEL } from './fixture'

describe('edge cases', () => {
  it('empty model → no parts, no bars, no fasteners qty', () => {
    const model = {
      lengthCm: 0,
      widthCm: 0,
      color: 'x',
      frame: { profileId: '12x4' as const },
      divisions: { count: 0 },
      shade: { count: 0, profileId: '2x7' as const },
    }
    const parts = buildParts(model)
    expect(parts).toEqual([])
    const nested = nest(parts)
    expect(nested.bars).toEqual([])
    expect(nested.totalWastePct).toBe(0)
    const bom = buildBom(model)
    expect(bom.aluminum).toEqual([])
    expect(bom.fasteners.every((l) => l.quantity === 0)).toBe(true)
  })

  it('zero-length members are dropped', () => {
    const parts = buildParts({
      ...ACCEPTANCE_MODEL,
      lengthCm: 0,
      widthCm: 0,
      divisions: { count: 3 },
      shade: { count: 44, profileId: '2x7' },
    })
    expect(parts.every((p) => p.lengthCm > 0)).toBe(true)
    expect(parts).toHaveLength(0)
  })

  it('a part longer than stock is split, not dropped', () => {
    const parts = buildParts({
      ...ACCEPTANCE_MODEL,
      lengthCm: 800,
      shade: { count: 0, profileId: '2x7' },
      divisions: { count: 0 },
    }, { frameMethod: 'builtin_kant' })
    const frames = parts.filter((p) => p.kind === 'frame' && p.lengthCm === 800)
    const result = nest(frames, { frameSplit: 'economical' })
    const placed = result.bars.flatMap((b) => b.cuts)
    expect(placed.reduce((s, c) => s + c.lengthCm, 0)).toBe(800 * frames.length)
    expect(placed.every((c) => c.lengthCm <= 600)).toBe(true)
  })

  it('shade longer than stock is split economically', () => {
    const parts = buildParts({
      lengthCm: 800,
      widthCm: 0,
      color: 'x',
      frame: { profileId: '12x4' },
      divisions: { count: 0 },
      shade: { count: 1, profileId: '2x7' },
    }, { frameMethod: 'builtin_kant' })
    const shade = parts.filter((p) => p.kind === 'shade')
    const result = nest(shade)
    expect(result.bars.flatMap((b) => b.cuts).map((c) => c.lengthCm).sort((a, b) => b - a)).toEqual([600, 200])
  })
})
