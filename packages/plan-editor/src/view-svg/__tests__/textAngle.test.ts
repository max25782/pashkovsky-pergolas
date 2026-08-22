import { describe, it, expect } from 'vitest'
import { readableLabelAngleDeg } from '../textAngle'

describe('readableLabelAngleDeg', () => {
  it.each([
    ['pointing right (0°)', 100, 0, 0],
    ['pointing down-right screen (45°)', 100, 100, 45],
    ['pointing straight down screen (90°)', 0, 100, 90],
    ['pointing straight up screen (-90°)', 0, -100, -90],
    ['pointing up-right screen (-45°)', 100, -100, -45],
  ])('%s stays within [-90, 90] unflipped', (_label, dx, dy, expected) => {
    expect(readableLabelAngleDeg(dx, dy)).toBeCloseTo(expected, 10)
  })

  it.each([
    ['pointing left (180°) → flipped to 0°, never upside-down', -100, 0, 0],
    ['pointing down-left screen (135°) → flipped to -45°', -100, 100, -45],
    ['pointing up-left screen (-135°) → flipped to 45°', -100, -100, 45],
  ])('%s', (_label, dx, dy, expected) => {
    expect(readableLabelAngleDeg(dx, dy)).toBeCloseTo(expected, 10)
  })

  it('never returns an angle whose absolute value exceeds 90° (never upside-down)', () => {
    for (let deg = -180; deg <= 180; deg += 5) {
      const rad = (deg * Math.PI) / 180
      const angle = readableLabelAngleDeg(Math.cos(rad), Math.sin(rad))
      expect(Math.abs(angle)).toBeLessThanOrEqual(90 + 1e-9)
    }
  })

  it('the resulting angle always lies on the same line (mod 180°) as the raw direction', () => {
    // Флип на 180° не меняет линию, на которой лежит текст — только его "верх".
    for (let deg = -180; deg <= 180; deg += 13) {
      const rad = (deg * Math.PI) / 180
      const dx = Math.cos(rad)
      const dy = Math.sin(rad)
      const angle = readableLabelAngleDeg(dx, dy)
      const rawAngle = (Math.atan2(dy, dx) * 180) / Math.PI
      const diff = Math.abs(angle - rawAngle) % 180
      expect(diff < 1e-6 || Math.abs(diff - 180) < 1e-6 || Math.abs(diff) < 1e-6).toBe(true)
    }
  })
})
