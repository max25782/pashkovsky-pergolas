import { describe, it, expect } from 'vitest'
import { resolveDirection, angularDistance, normalizeAngle } from '../snap'
import { DEFAULT_SNAP_CONFIG } from '../types'
import type { Point, Modifiers, SnapConfig } from '../types'

const ORIGIN: Point = { x: 0, y: 0 }

/**
 * Строит точку на расстоянии `dist` от `from` под углом `angleDeg`.
 * Используется только для НЕ-граничных кейсов (see boundary note below) —
 * atan2(sin,cos) вносит тригонометрический шум ~1e-13°, не влияющий на явно
 * "внутри/снаружи" случаи, но недопустимый для проверки "ровно на границе".
 */
function pointAtAngle(from: Point, angleDeg: number, dist = 100): Point {
  const rad = (angleDeg * Math.PI) / 180
  return { x: from.x + Math.cos(rad) * dist, y: from.y + Math.sin(rad) * dist }
}

const FREE: Modifiers = { lockOrtho: false, freeform: true }
const ORTHO: Modifiers = { lockOrtho: true, freeform: false }
const POLAR: Modifiers = { lockOrtho: false, freeform: false }

describe('resolveDirection — freeform (raw, no snap)', () => {
  it.each([
    { angle: 43, label: 'off-grid angle' },
    { angle: 90, label: 'even on an ortho angle — freeform still wins' },
    { angle: 45, label: 'even on a polar angle — freeform still wins' },
  ])('freeform=true → raw angle, snapped=false ($label)', ({ angle }) => {
    const cursor = pointAtAngle(ORIGIN, angle)
    const result = resolveDirection(ORIGIN, cursor, FREE, DEFAULT_SNAP_CONFIG)
    expect(result.snapped).toBe(false)
    expect(result.snapAngle).toBeNull()
    expect(result.angleDeg).toBeCloseTo(normalizeAngle(angle), 5)
  })

  it('freeform takes priority over lockOrtho when both are true', () => {
    const cursor = pointAtAngle(ORIGIN, 43)
    const bothMods: Modifiers = { lockOrtho: true, freeform: true }
    const result = resolveDirection(ORIGIN, cursor, bothMods, DEFAULT_SNAP_CONFIG)
    expect(result.snapped).toBe(false)
    expect(result.angleDeg).toBeCloseTo(43, 5)
  })
})

describe('resolveDirection — lockOrtho (hard snap to 0/90/180/270)', () => {
  it.each([
    { cursorAngle: 10, expected: 0 },
    { cursorAngle: 80, expected: 90 },
    { cursorAngle: 100, expected: 90 },
    { cursorAngle: 179, expected: 180 },
    { cursorAngle: 271, expected: 270 },
    { cursorAngle: 46, expected: 90 }, // nearer to 90 (delta 44) than to 0 (delta 46)
    { cursorAngle: 44, expected: 0 },  // nearer to 0 (delta 44) than to 90 (delta 46)
  ])('cursor at $cursorAngle° → snaps to $expected° regardless of threshold', ({ cursorAngle, expected }) => {
    const cursor = pointAtAngle(ORIGIN, cursorAngle)
    const result = resolveDirection(ORIGIN, cursor, ORTHO, DEFAULT_SNAP_CONFIG)
    expect(result.snapped).toBe(true)
    expect(result.snapAngle).toBe(expected)
    expect(result.angleDeg).toBe(expected)
  })
})

describe('resolveDirection — polar snap (soft snap within threshold)', () => {
  it.each([
    { cursorAngle: 45, expectSnap: true, expectedAngle: 45, label: 'exactly on a snap candidate' },
    { cursorAngle: 42, expectSnap: true, expectedAngle: 45, label: 'clearly inside threshold (delta 3°)' },
    { cursorAngle: 3, expectSnap: true, expectedAngle: 0, label: 'clearly inside threshold near 0°' },
    { cursorAngle: 355, expectSnap: true, expectedAngle: 0, label: 'wrap-around inside threshold (delta 5°)' },
    { cursorAngle: 35, expectSnap: false, expectedAngle: null, label: 'clearly outside threshold (nearest 45, delta 10°)' },
    { cursorAngle: 8, expectSnap: false, expectedAngle: null, label: 'clearly outside threshold near 0° (delta 8°)' },
  ])('cursor at $cursorAngle° → $label', ({ cursorAngle, expectSnap, expectedAngle }) => {
    const cursor = pointAtAngle(ORIGIN, cursorAngle)
    const result = resolveDirection(ORIGIN, cursor, POLAR, DEFAULT_SNAP_CONFIG)
    expect(result.snapped).toBe(expectSnap)
    if (expectSnap) {
      expect(result.snapAngle).toBe(expectedAngle)
      expect(result.angleDeg).toBe(expectedAngle)
    } else {
      expect(result.snapAngle).toBeNull()
      expect(result.angleDeg).toBeCloseTo(normalizeAngle(cursorAngle), 5)
    }
  })

  it('respects a custom SnapConfig (different angles/threshold)', () => {
    const customConfig: SnapConfig = { snapAngles: [30, 60], thresholdDeg: 2 }
    const cursor = pointAtAngle(ORIGIN, 31) // delta to 30 = 1, inside threshold 2
    const result = resolveDirection(ORIGIN, cursor, POLAR, customConfig)
    expect(result.snapped).toBe(true)
    expect(result.snapAngle).toBe(30)
  })

  it('custom SnapConfig: miss when delta exceeds the custom threshold', () => {
    const customConfig: SnapConfig = { snapAngles: [30, 60], thresholdDeg: 2 }
    const cursor = pointAtAngle(ORIGIN, 34) // delta to 30 = 4, outside threshold 2
    const result = resolveDirection(ORIGIN, cursor, POLAR, customConfig)
    expect(result.snapped).toBe(false)
  })
})

/**
 * Граница порога (delta === thresholdDeg) проверяется на чистой числовой
 * функции angularDistance, а НЕ через resolveDirection с atan2.
 *
 * Причина: rawAngle внутри resolveDirection получается из atan2(sin,cos),
 * что вносит тригонометрический шум порядка 1e-13°. Для "явно внутри/снаружи"
 * кейсов этот шум не имеет значения, но для теста "ровно на границе"
 * (delta = 7.0 или 6.999999999999) он делает assertion недетерминированным —
 * можно случайно поймать то snapped=true, то snapped=false в зависимости
 * от платформы/движка. angularDistance принимает числа напрямую — без
 * тригонометрии на входе, поэтому граница проверяется здесь честно.
 */
describe('angularDistance — exact threshold boundary (7.0°)', () => {
  it.each([
    { a: 45, b: 52, expected: 7, label: 'simple case, no wrap' },
    { a: 358, b: 351, expected: 7, label: 'no wrap, both near 360' },
    { a: 3, b: 356, expected: 7, label: 'wrap-around across 0°/360°' },
  ])('angularDistance($a, $b) === $expected ($label)', ({ a, b, expected }) => {
    expect(angularDistance(a, b)).toBe(expected)
  })

  it('delta exactly equal to threshold (7.0) is INCLUSIVE — comparison must use <=, not <', () => {
    const delta = angularDistance(45, 52)
    expect(delta).toBe(7)
    // This mirrors the exact comparison used inside resolveDirection:
    // `delta <= config.thresholdDeg`. If it were `<`, this case would wrongly miss.
    expect(delta <= 7).toBe(true)
  })

  it('delta just over the threshold (7.0001) must NOT snap', () => {
    const delta = angularDistance(45, 52.0001)
    expect(delta).toBeCloseTo(7.0001, 4)
    expect(delta <= 7).toBe(false)
  })

  it('delta just under the threshold (6.9999) must snap', () => {
    const delta = angularDistance(45, 51.9999)
    expect(delta).toBeCloseTo(6.9999, 4)
    expect(delta <= 7).toBe(true)
  })
})

describe('normalizeAngle', () => {
  it.each([
    { input: 0, expected: 0 },
    { input: 360, expected: 0 },
    { input: 361, expected: 1 },
    { input: -1, expected: 359 },
    { input: -361, expected: 359 },
    { input: 720, expected: 0 },
  ])('normalizeAngle($input) === $expected', ({ input, expected }) => {
    expect(normalizeAngle(input)).toBe(expected)
  })
})
