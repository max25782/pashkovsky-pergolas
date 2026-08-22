import { describe, it, expect } from 'vitest'
import {
  worldToScreen,
  screenToWorld,
  computeFitToScreenViewport,
  projectOntoRay,
  dirFromAngle,
  distance,
} from '../coords'
import type { Viewport } from '../types'

describe('worldToScreen / screenToWorld — Y-flip', () => {
  const vp: Viewport = { scale: 2, panX: 100, panY: 100 }

  it('world (0,0) maps to screen (panX, panY)', () => {
    expect(worldToScreen({ x: 0, y: 0 }, vp)).toEqual({ x: 100, y: 100 })
  })

  it('moving UP in world (+Y) moves UP on screen (−Y in screen space)', () => {
    // Мир: Y растёт вверх. Экран: Y растёт вниз. +10мм вверх в мире должно
    // дать МЕНЬШИЙ screen.y (визуально выше), а не больший.
    const screenPt = worldToScreen({ x: 0, y: 10 }, vp)
    expect(screenPt.y).toBeLessThan(vp.panY)
    expect(screenPt).toEqual({ x: 100, y: 100 - 10 * vp.scale })
  })

  it('moving RIGHT in world (+X) moves RIGHT on screen (+X, no flip)', () => {
    const screenPt = worldToScreen({ x: 10, y: 0 }, vp)
    expect(screenPt.x).toBeGreaterThan(vp.panX)
    expect(screenPt).toEqual({ x: 100 + 10 * vp.scale, y: 100 })
  })

  it('screenToWorld is the exact inverse of worldToScreen', () => {
    const original = { x: 37.5, y: -142.25 }
    const roundTripped = screenToWorld(worldToScreen(original, vp), vp)
    expect(roundTripped.x).toBeCloseTo(original.x, 10)
    expect(roundTripped.y).toBeCloseTo(original.y, 10)
  })
})

describe('computeFitToScreenViewport', () => {
  it('centers the world bounds center at the canvas center', () => {
    const bounds = { minX: -5000, minY: -5000, maxX: 5000, maxY: 5000 }
    const canvas = { widthPx: 800, heightPx: 600 }
    const vp = computeFitToScreenViewport(bounds, canvas)

    const screenCenter = worldToScreen({ x: 0, y: 0 }, vp)
    expect(screenCenter.x).toBeCloseTo(400, 5)
    expect(screenCenter.y).toBeCloseTo(300, 5)
  })

  it('picks the smaller of the two axis scales so the whole polygon fits', () => {
    // Мир 10000×10000мм в холст 800×400 (узкий) — по высоте теснее, значит
    // именно высота должна определить масштаб.
    const bounds = { minX: 0, minY: 0, maxX: 10000, maxY: 10000 }
    const canvas = { widthPx: 800, heightPx: 400 }
    const vp = computeFitToScreenViewport(bounds, canvas, 0.1)

    const usableHeightPx = 400 * 0.8
    const expectedScale = usableHeightPx / 10000
    expect(vp.scale).toBeCloseTo(expectedScale, 10)
  })

  it('does not hardcode scale — result depends on canvas size', () => {
    const bounds = { minX: 0, minY: 0, maxX: 8000, maxY: 8000 }
    const small = computeFitToScreenViewport(bounds, { widthPx: 400, heightPx: 400 })
    const large = computeFitToScreenViewport(bounds, { widthPx: 1200, heightPx: 1200 })
    expect(small.scale).not.toBeCloseTo(large.scale, 5)
    expect(large.scale).toBeGreaterThan(small.scale)
  })
})

describe('projectOntoRay', () => {
  it('projects a cursor straight ahead onto a 0° ray unchanged (already on the ray)', () => {
    const from = { x: 0, y: 0 }
    const cursor = { x: 50, y: 0 }
    expect(projectOntoRay(from, 0, cursor)).toEqual({ x: 50, y: 0 })
  })

  it('projects an off-ray cursor onto the 90° ray (keeps only the Y-component)', () => {
    const from = { x: 0, y: 0 }
    const cursor = { x: 30, y: 40 } // off to the side
    const proj = projectOntoRay(from, 90, cursor)
    expect(proj.x).toBeCloseTo(0, 10)
    expect(proj.y).toBeCloseTo(40, 10)
  })
})

describe('dirFromAngle', () => {
  it.each([
    [0, 1, 0],
    [90, 0, 1],
    [180, -1, 0],
    [270, 0, -1],
  ])('angle %d° → unit vector (%d, %d)', (deg, x, y) => {
    const dir = dirFromAngle(deg)
    expect(dir.x).toBeCloseTo(x, 10)
    expect(dir.y).toBeCloseTo(y, 10)
  })

  it('always returns a unit vector, for any angle', () => {
    const dir = dirFromAngle(37)
    expect(Math.hypot(dir.x, dir.y)).toBeCloseTo(1, 10)
  })
})

describe('distance', () => {
  it('is 0 for identical points', () => {
    expect(distance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0)
  })

  it('matches the 3-4-5 right triangle', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })

  it('is symmetric', () => {
    const a = { x: 12, y: -7 }
    const b = { x: -3, y: 40 }
    expect(distance(a, b)).toBeCloseTo(distance(b, a), 10)
  })
})
