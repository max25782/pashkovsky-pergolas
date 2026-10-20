import { describe, expect, it } from 'vitest'
import { buildBom, buildParts, fasteners, nest } from '../index'
import { DEFAULT_FASTENER_RULES } from '../defaults'
import { ACCEPTANCE_MODEL } from './fixture'

describe('Stage 13 acceptance — 600×400 rectangle', () => {
  const parts = buildParts(ACCEPTANCE_MODEL)
  const nested = nest(parts)
  const lines = fasteners(ACCEPTANCE_MODEL, parts, DEFAULT_FASTENER_RULES)

  it('emits frame 600×2 and 400×2 with 45° both ends and both cut lengths', () => {
    const frames = parts.filter((p) => p.kind === 'frame')
    expect(frames).toHaveLength(4)
    const longs = frames.filter((p) => p.lengthCm === 600)
    const shorts = frames.filter((p) => p.lengthCm === 400)
    expect(longs).toHaveLength(2)
    expect(shorts).toHaveLength(2)
    for (const f of frames) {
      expect(f.miterStartDeg).toBe(45)
      expect(f.miterEndDeg).toBe(45)
      expect(f.lengthLongCm).toBe(f.lengthCm)
      expect(f.lengthShortCm).toBe(f.lengthCm - 8)
    }
    expect(longs[0].lengthShortCm).toBe(592)
    expect(shorts[0].lengthShortCm).toBe(392)
  })

  it('division length is inner width 400 − 2×4 = 392, three pieces', () => {
    const divisions = parts.filter((p) => p.kind === 'division')
    expect(divisions).toHaveLength(3)
    expect(divisions.every((d) => d.lengthCm === 392)).toBe(true)
    expect(divisions.every((d) => d.profileId === '12x4')).toBe(true)
  })

  it('nests 12x4 into 7 bars (no pair shares a bar)', () => {
    const bars = nested.bars.filter((b) => b.profileId === '12x4')
    expect(bars).toHaveLength(7)
    for (const bar of bars) {
      expect(bar.cuts).toHaveLength(1)
      expect(bar.stockLengthCm).toBe(600)
    }
    const lengths = bars.map((b) => b.cuts[0].lengthCm).sort((a, b) => b - a)
    expect(lengths).toEqual([600, 600, 400, 400, 392, 392, 392])
  })

  it('nests 2x7 into 44 full bars with no remainder', () => {
    const bars = nested.bars.filter((b) => b.profileId === '2x7')
    expect(bars).toHaveLength(44)
    expect(bars.every((b) => b.cuts.length === 1 && b.cuts[0].lengthCm === 600)).toBe(true)
    expect(bars.every((b) => b.remainderCm === 0)).toBe(true)
  })

  it('nests 3x2 into 4 bars (600×2, 400×2)', () => {
    const bars = nested.bars.filter((b) => b.profileId === '3x2')
    expect(bars).toHaveLength(4)
    const lengths = bars.map((b) => b.cuts[0].lengthCm).sort((a, b) => b - a)
    expect(lengths).toEqual([600, 600, 400, 400])
  })

  it('shade screws: 44 × (3+2) = 220, +5% → 231', () => {
    const line = lines.find((l) => l.id === 'shade_screws')!
    expect(line.quantity).toBe(220)
    expect(line.formula).toBe('44 профиля затенения × (3 делительных + 2 рамные) = 220')
    expect(line.sparePct).toBe(5)
    expect(line.total).toBe(231)
  })

  it('construction screws: 40 + 5% → 42', () => {
    const line = lines.find((l) => l.id === 'construction_screws')!
    expect(line.quantity).toBe(40)
    expect(line.total).toBe(42)
    expect(line.formula).toContain('= 40')
  })

  it('angle screws: 54 + 5% → 57 (floor(L/40)+1 per side)', () => {
    const line = lines.find((l) => l.id === 'angle_screws')!
    expect(line.quantity).toBe(54)
    expect(line.total).toBe(57)
  })

  it('buildBom totals match nest bar counts', () => {
    const bom = buildBom(ACCEPTANCE_MODEL)
    const byProfile = Object.fromEntries(bom.aluminum.map((l) => [l.profileId, l.bars]))
    expect(byProfile['12x4']).toBe(7)
    expect(byProfile['2x7']).toBe(44)
    expect(byProfile['3x2']).toBe(4)
    expect(bom.parts.filter((p) => p.kind === 'frame')).toHaveLength(4)
  })
})
