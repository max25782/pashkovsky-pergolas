import { describe, it, expect } from 'vitest'
import { isSimplePolygon } from '../selfIntersection'
import type { Point } from '../types'

describe('isSimplePolygon', () => {
  it('accepts a convex rectangle', () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ]
    expect(isSimplePolygon(points)).toBe(true)
  })

  it('accepts a concave L-shape (armpit vertex > 180°)', () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 100 },
      { x: 100, y: 100 },
      { x: 100, y: 200 },
      { x: 0, y: 200 },
    ]
    expect(isSimplePolygon(points)).toBe(true)
  })

  it('accepts any triangle (three edges can never self-intersect — all pairs are adjacent)', () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 100 },
    ]
    expect(isSimplePolygon(points)).toBe(true)
  })

  it('rejects a classic bowtie/zigzag self-crossing quadrilateral', () => {
    // 0-1-2-3-0 где ребро 1→2 пересекает ребро 3→0 (не соседние).
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
    ]
    expect(isSimplePolygon(points)).toBe(false)
  })

  it('rejects a self-intersecting hexagon where the closing edge crosses an earlier side', () => {
    // Пять сторон рисуют нормальную фигуру, шестая (замыкающая) режет сторону 1→2.
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 200 },
      { x: 50, y: -50 }, // уводит контур обратно вверх, пересекая ребро (0,0)-(200,0)
      { x: 50, y: 300 },
      { x: -50, y: 300 },
    ]
    expect(isSimplePolygon(points)).toBe(false)
  })

  it('treats edges sharing a vertex (adjacent, including wrap-around last↔first) as non-intersecting', () => {
    // Вырожденно узкий "домик" — соседние рёбра касаются в общей вершине, это не пересечение.
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 50, y: 150 },
      { x: 0, y: 100 },
    ]
    expect(isSimplePolygon(points)).toBe(true)
  })

  it('returns true for degenerate inputs (n < 3) — caller is responsible for the "need more sides" check', () => {
    expect(isSimplePolygon([])).toBe(true)
    expect(isSimplePolygon([{ x: 0, y: 0 }])).toBe(true)
    expect(isSimplePolygon([{ x: 0, y: 0 }, { x: 10, y: 10 }])).toBe(true)
  })

  it('rejects a pentagon where a non-adjacent pair of edges crosses', () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 200 },
      { x: -50, y: 200 },
      { x: 150, y: -100 },
    ]
    expect(isSimplePolygon(points)).toBe(false)
  })
})
