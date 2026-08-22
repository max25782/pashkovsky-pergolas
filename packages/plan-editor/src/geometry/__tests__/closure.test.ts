import { describe, it, expect } from 'vitest'
import { closureGap, applyStartMagnet, DEFAULT_MAGNET_THRESHOLD_PX } from '../closure'
import { distance } from '../coords'
import type { FixedEdge, DraftEdge, Viewport } from '../types'

function edge(angleDeg: number, lengthMm: number): FixedEdge {
  return { id: 'e', from: { x: 0, y: 0 }, to: { x: 0, y: 0 }, angleDeg, lengthMm }
}

describe('closureGap', () => {
  it('is ~(0,0) for a perfectly closed rectangle', () => {
    const rect: FixedEdge[] = [edge(0, 1000), edge(90, 500), edge(180, 1000), edge(270, 500)]
    const gap = closureGap(rect)
    expect(gap.dx).toBeCloseTo(0, 6)
    expect(gap.dy).toBeCloseTo(0, 6)
    expect(gap.distMm).toBeCloseTo(0, 6)
  })

  it('reports ~100mm gap when one side of a rectangle is deliberately lengthened by 100mm', () => {
    const broken: FixedEdge[] = [edge(0, 1100), edge(90, 500), edge(180, 1000), edge(270, 500)]
    const gap = closureGap(broken)
    expect(gap.distMm).toBeCloseTo(100, 6)
    // Lengthened the first (0°) side → the whole gap should show up on the X axis.
    expect(gap.dx).toBeCloseTo(100, 6)
    expect(gap.dy).toBeCloseTo(0, 6)
  })

  it('is exactly (0,0) for an empty contour (no crash, no NaN)', () => {
    const gap = closureGap([])
    expect(gap).toEqual({ dx: 0, dy: 0, distMm: 0 })
  })

  it('accumulates gap from multiple inconsistent sides, not just one', () => {
    // Triangle where all three sides are shifted slightly off their exact-closing values.
    const triangle: FixedEdge[] = [edge(0, 1005), edge(120, 1010), edge(240, 995)]
    const gap = closureGap(triangle)
    expect(gap.distMm).toBeGreaterThan(0)
  })
})

describe('applyStartMagnet', () => {
  const viewport: Viewport = { scale: 0.05, panX: 0, panY: 0 } // 1мм = 0.05px

  function draft(toX: number, toY: number): DraftEdge {
    return { from: { x: 0, y: 0 }, to: { x: toX, y: toY }, dir: { angleDeg: 0, snapped: false, snapAngle: null } }
  }

  it('snaps to startPoint and sets closesContour when within threshold and canClose=true', () => {
    // 200мм * 0.05 = 10px < DEFAULT_MAGNET_THRESHOLD_PX (25px).
    const result = applyStartMagnet(draft(200, 0), { x: 0, y: 0 }, viewport, true, DEFAULT_MAGNET_THRESHOLD_PX)
    expect(result.to).toEqual({ x: 0, y: 0 })
    expect(result.closesContour).toBe(true)
  })

  it('leaves the edge untouched when outside the threshold', () => {
    // 1000мм * 0.05 = 50px > DEFAULT_MAGNET_THRESHOLD_PX (25px).
    const original = draft(1000, 0)
    const result = applyStartMagnet(original, { x: 0, y: 0 }, viewport, true, DEFAULT_MAGNET_THRESHOLD_PX)
    expect(result).toEqual(original)
    expect(result.closesContour).toBeUndefined()
  })

  it('leaves the edge untouched when canClose=false, even if geometrically close enough', () => {
    const original = draft(200, 0)
    const result = applyStartMagnet(original, { x: 0, y: 0 }, viewport, false, DEFAULT_MAGNET_THRESHOLD_PX)
    expect(result).toEqual(original)
    expect(result.closesContour).toBeUndefined()
  })

  it('respects a custom thresholdPx', () => {
    // 200мм * 0.05 = 10px. С порогом 5px это уже НЕ ближе порога.
    const result = applyStartMagnet(draft(200, 0), { x: 0, y: 0 }, viewport, true, 5)
    expect(result.closesContour).toBeUndefined()
  })

  it('preserves `from` untouched (only `to` and `dir.angleDeg` change)', () => {
    const original = draft(200, 0)
    const result = applyStartMagnet(original, { x: 0, y: 0 }, viewport, true, DEFAULT_MAGNET_THRESHOLD_PX)
    expect(result.from).toEqual(original.from)
  })

  it('REGRESSION: recomputes dir.angleDeg to point exactly at startPoint, not at the raw cursor', () => {
    // Курсор НЕ идеально на startPoint (50,50 вместо 0,0) — реалистичный случай:
    // магнит цепляет по расстоянию в px, курсор внутри порога, но не пиксель-в-пиксель.
    // from далеко (anchor на конце длинной стороны), чтобы угловая ошибка была заметна.
    const from = { x: 500, y: 800 }
    const cursor = { x: 50, y: 50 }
    const edgeToward: DraftEdge = {
      from,
      to: cursor,
      dir: { angleDeg: (Math.atan2(cursor.y - from.y, cursor.x - from.x) * 180) / Math.PI, snapped: false, snapAngle: null },
    }
    const result = applyStartMagnet(edgeToward, { x: 0, y: 0 }, viewport, true, DEFAULT_MAGNET_THRESHOLD_PX)

    const expectedAngleDeg = ((Math.atan2(0 - from.y, 0 - from.x) * 180) / Math.PI + 360) % 360
    expect(result.dir.angleDeg).toBeCloseTo(expectedAngleDeg, 10)
    // И этот угол ОТЛИЧАЕТСЯ от исходного (к курсору) — вот в чём был баг.
    expect(Math.abs(result.dir.angleDeg - edgeToward.dir.angleDeg)).toBeGreaterThan(0.01)
  })

  it('REGRESSION: a triangle closed via the magnet has ~zero closureGap immediately (before any manual edit)', () => {
    // Тот самый сценарий с живого стенда, который выявил баг: (0,0)→(1000,0)→(500,800)→магнит→(0,0).
    const e0: FixedEdge = { id: 'e0', from: { x: 0, y: 0 }, to: { x: 1000, y: 0 }, angleDeg: 0, lengthMm: 1000 }
    const anchor1 = { x: 1000, y: 0 }
    const v2 = { x: 500, y: 800 }
    const angle1 = normalizeAngleDeg(Math.atan2(v2.y - anchor1.y, v2.x - anchor1.x))
    const e1: FixedEdge = { id: 'e1', from: anchor1, to: v2, angleDeg: angle1, lengthMm: distance(anchor1, v2) }

    // Курсор чуть в стороне от истинного (0,0) — как и было на стенде — магнит его туда прилипает.
    const cursor = { x: 50, y: 50 }
    const rawDraft: DraftEdge = {
      from: v2,
      to: cursor,
      dir: { angleDeg: normalizeAngleDeg(Math.atan2(cursor.y - v2.y, cursor.x - v2.x)), snapped: false, snapAngle: null },
    }
    const closingDraft = applyStartMagnet(rawDraft, { x: 0, y: 0 }, viewport, true, DEFAULT_MAGNET_THRESHOLD_PX)
    const e2: FixedEdge = {
      id: 'e2',
      from: closingDraft.from,
      to: closingDraft.to,
      angleDeg: closingDraft.dir.angleDeg,
      lengthMm: distance(closingDraft.from, closingDraft.to),
    }

    const gap = closureGap([e0, e1, e2])
    expect(gap.distMm).toBeLessThan(0.01)
  })
})

function normalizeAngleDeg(rad: number): number {
  return ((rad * 180) / Math.PI + 360) % 360
}
