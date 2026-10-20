/**
 * Invariants that must fail if the implementation is mutated:
 *  - ignore kerf
 *  - drop a part
 *  - skip spare_pct
 *  - wrong frame miter
 *
 * The mutation run (stage 13 §4) temporarily breaks each site and
 * re-runs this file; those runs are expected to fail.
 */
import { describe, expect, it } from 'vitest'
import { buildParts, fasteners, nest, nestLengthCm } from '../index'
import { DEFAULT_FASTENER_RULES, DEFAULT_KERF_CM, DEFAULT_SPARE_PCT } from '../defaults'
import { ACCEPTANCE_MODEL } from './fixture'

describe('mutation guards', () => {
  it('fails if kerf is not charged between two pieces on one bar', () => {
    const parts = [
      { id: 'a', kind: 'division' as const, profileId: '12x4', color: 'x', lengthCm: 200 },
      { id: 'b', kind: 'division' as const, profileId: '12x4', color: 'x', lengthCm: 200 },
    ]
    const bar = nest(parts).bars[0]
    const cutSum = bar.cuts.reduce((s, c) => s + c.lengthCm, 0)
    expect(cutSum + DEFAULT_KERF_CM + bar.remainderCm).toBeCloseTo(600, 8)
    expect(bar.remainderCm).not.toBeCloseTo(600 - cutSum, 8)
  })

  it('fails if any acceptance part is lost or duplicated', () => {
    const parts = buildParts(ACCEPTANCE_MODEL)
    const result = nest(parts)
    const origins = result.bars.flatMap((b) => b.cuts.map((c) => c.originPartId))
    const expected = parts.filter((p) => nestLengthCm(p) > 0).map((p) => p.id)
    expect(new Set(origins)).toEqual(new Set(expected))
    for (const id of expected) {
      const sum = result.bars.flatMap((b) => b.cuts).filter((c) => c.originPartId === id)
        .reduce((s, c) => s + c.lengthCm, 0)
      const part = parts.find((p) => p.id === id)!
      expect(sum).toBeCloseTo(nestLengthCm(part), 6)
    }
  })

  it('fails if spare_pct is not applied (ceil qty × 1.05)', () => {
    const parts = buildParts(ACCEPTANCE_MODEL)
    const shade = fasteners(ACCEPTANCE_MODEL, parts, DEFAULT_FASTENER_RULES).find((l) => l.id === 'shade_screws')!
    expect(DEFAULT_SPARE_PCT).toBe(5)
    expect(shade.quantity).toBe(220)
    expect(shade.total).toBe(231)
    expect(shade.total).not.toBe(shade.quantity)
  })

  it('fails if frame miters are not 45° / long-short pair is wrong', () => {
    const frames = buildParts(ACCEPTANCE_MODEL).filter((p) => p.kind === 'frame')
    expect(frames.every((f) => f.miterStartDeg === 45 && f.miterEndDeg === 45)).toBe(true)
    expect(frames.find((f) => f.lengthCm === 600)?.lengthShortCm).toBe(592)
    expect(frames.find((f) => f.lengthCm === 400)?.lengthShortCm).toBe(392)
  })
})
