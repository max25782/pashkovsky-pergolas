import { describe, it, expect } from 'vitest'
import { rebuildChain, currentAnchor, toPolygon, wallEdgeIndicesFromChain } from '../chain'
import type { FixedEdge, Point } from '../types'

const START: Point = { x: 0, y: 0 }

/** Цепочка из 3 звеньев: 0° 500мм → 90° 300мм → 0° 400мм. */
function threeLinkChain(): FixedEdge[] {
  return [
    { id: 'a', from: { x: 0, y: 0 }, to: { x: 500, y: 0 }, angleDeg: 0, lengthMm: 500 },
    { id: 'b', from: { x: 500, y: 0 }, to: { x: 500, y: 300 }, angleDeg: 90, lengthMm: 300 },
    { id: 'c', from: { x: 500, y: 300 }, to: { x: 900, y: 300 }, angleDeg: 0, lengthMm: 400 },
  ]
}

describe('rebuildChain', () => {
  it('reproduces from/to unchanged when nothing was edited (idempotent)', () => {
    const edges = threeLinkChain()
    const rebuilt = rebuildChain(edges, START)
    expect(rebuilt).toEqual(edges)
  })

  it('editing the middle link length: first link untouched, tail shifted by exactly the delta', () => {
    const edges = threeLinkChain()
    // Звено b: было 300мм по 90°, меняем на 500мм (+200мм)
    const edited = edges.map((e) => (e.id === 'b' ? { ...e, lengthMm: 500 } : e))
    const rebuilt = rebuildChain(edited, START)

    const [a, b, c] = rebuilt

    // Первое звено — от старта, направление и длина не изменились → on-place
    expect(a.from).toEqual({ x: 0, y: 0 })
    expect(a.to).toEqual({ x: 500, y: 0 })

    // Отредактированное звено: from — конец первого (не двигался), to — новая длина
    expect(b.from).toEqual({ x: 500, y: 0 })
    expect(b.to.x).toBeCloseTo(500, 10)
    expect(b.to.y).toBeCloseTo(500, 10)

    // Третье звено (хвост): angleDeg/lengthMm не менялись, но from/to съехали
    // ровно на дельту (+200мм по Y, потому что звено b было вертикальным)
    expect(c.angleDeg).toBe(0)
    expect(c.lengthMm).toBe(400)
    expect(c.from.x).toBeCloseTo(500, 10)
    expect(c.from.y).toBeCloseTo(500, 10) // было 300, стало 500 — сдвиг на дельту 200
    expect(c.to.x).toBeCloseTo(900, 10)
    expect(c.to.y).toBeCloseTo(500, 10)
  })

  it('editing the middle link angle: length preserved, tail recomputed from the new direction', () => {
    const edges = threeLinkChain()
    // Звено b: было 90° (вертикально), меняем на 45°, длина остаётся 300
    const edited = edges.map((e) => (e.id === 'b' ? { ...e, angleDeg: 45 } : e))
    const rebuilt = rebuildChain(edited, START)
    const [a, b, c] = rebuilt

    expect(a.to).toEqual({ x: 500, y: 0 })

    expect(b.lengthMm).toBe(300)
    expect(b.to.x).toBeCloseTo(500 + 300 * Math.cos((45 * Math.PI) / 180), 10)
    expect(b.to.y).toBeCloseTo(300 * Math.sin((45 * Math.PI) / 180), 10)

    // Хвост стартует ровно от нового конца b
    expect(c.from.x).toBeCloseTo(b.to.x, 10)
    expect(c.from.y).toBeCloseTo(b.to.y, 10)
  })

  it('empty chain returns empty chain', () => {
    expect(rebuildChain([], START)).toEqual([])
  })

  it('a different startAnchor shifts the entire chain rigidly', () => {
    const edges = threeLinkChain()
    const anchor: Point = { x: 1000, y: 1000 }
    const rebuilt = rebuildChain(edges, anchor)

    expect(rebuilt[0].from).toEqual(anchor)
    expect(rebuilt[0].to).toEqual({ x: 1500, y: 1000 })
    expect(rebuilt[2].to).toEqual({ x: 1900, y: 1300 })
  })
})

describe('currentAnchor', () => {
  it('returns startPoint when the chain is empty', () => {
    expect(currentAnchor([], START)).toEqual(START)
  })

  it('returns the `to` of the last edge when the chain is non-empty', () => {
    const edges = threeLinkChain()
    expect(currentAnchor(edges, START)).toEqual(edges[2].to)
  })

  it('does not depend on edge order in the array beyond "last" — uses array position, not geometry', () => {
    // Явная фиксация контракта: "последнее" = последний элемент массива,
    // а не элемент с наибольшим to.x/to.y или иной геометрической метрикой.
    const edges = threeLinkChain()
    expect(currentAnchor(edges, START)).toEqual({ x: 900, y: 300 })
  })
})

describe('toPolygon', () => {
  it('returns empty array for an empty chain', () => {
    expect(toPolygon([])).toEqual([])
  })

  it('returns one vertex per edge (its `from` point), in order', () => {
    const edges = threeLinkChain()
    expect(toPolygon(edges)).toEqual([
      { x: 0, y: 0 },
      { x: 500, y: 0 },
      { x: 500, y: 300 },
    ])
  })

  it('for a closed contour, the last edge\'s `to` equals the first vertex (implicit closing edge)', () => {
    const edges: FixedEdge[] = [
      { id: 'a', from: { x: 0, y: 0 }, to: { x: 500, y: 0 }, angleDeg: 0, lengthMm: 500 },
      { id: 'b', from: { x: 500, y: 0 }, to: { x: 500, y: 500 }, angleDeg: 90, lengthMm: 500 },
      { id: 'c', from: { x: 500, y: 500 }, to: { x: 0, y: 500 }, angleDeg: 180, lengthMm: 500 },
      { id: 'd', from: { x: 0, y: 500 }, to: { x: 0, y: 0 }, angleDeg: 270, lengthMm: 500 },
    ]
    const polygon = toPolygon(edges)
    expect(polygon).toHaveLength(4)
    expect(edges[edges.length - 1].to).toEqual(polygon[0])
  })
})

describe('wallEdgeIndicesFromChain', () => {
  it('returns empty array when no edge is attachedToWall', () => {
    expect(wallEdgeIndicesFromChain(threeLinkChain())).toEqual([])
  })

  it('returns indices (0-based, matching toPolygon order) of edges with attachedToWall === true', () => {
    const edges = threeLinkChain().map((e, i) => (i === 1 ? { ...e, attachedToWall: true } : e))
    expect(wallEdgeIndicesFromChain(edges)).toEqual([1])
  })

  it('collects multiple wall-attached edges — L-shape corner case (two adjacent wall sides)', () => {
    const edges = threeLinkChain().map((e, i) => ({ ...e, attachedToWall: i === 0 || i === 2 }))
    expect(wallEdgeIndicesFromChain(edges)).toEqual([0, 2])
  })

  it('ignores attachedToWall === false explicitly (not just falsy/undefined)', () => {
    const edges = threeLinkChain().map((e) => ({ ...e, attachedToWall: false }))
    expect(wallEdgeIndicesFromChain(edges)).toEqual([])
  })
})
