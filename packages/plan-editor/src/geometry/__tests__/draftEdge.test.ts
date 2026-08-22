import { describe, it, expect } from 'vitest'
import { buildDraftEdge, finalizeDraftEdge } from '../draftEdge'
import { distance } from '../coords'
import { DEFAULT_SNAP_CONFIG } from '../types'
import type { Point, Modifiers, DraftEdge } from '../types'

const ORIGIN: Point = { x: 0, y: 0 }
const FREE: Modifiers = { lockOrtho: false, freeform: true }
const POLAR: Modifiers = { lockOrtho: false, freeform: false }

describe('buildDraftEdge', () => {
  it('freeform: `to` lands exactly on the raw cursor (no snap, no projection drift)', () => {
    const cursor: Point = { x: 30, y: 40 }
    const edge = buildDraftEdge(ORIGIN, cursor, FREE, DEFAULT_SNAP_CONFIG)
    expect(edge.dir.snapped).toBe(false)
    expect(edge.to.x).toBeCloseTo(30, 10)
    expect(edge.to.y).toBeCloseTo(40, 10)
  })

  it('snapped: `to` is projected onto the snapped ray, NOT the raw cursor', () => {
    // Курсор чуть в стороне от 45°, попадает в порог привязки → snapAngle = 45
    const cursor: Point = { x: 105, y: 95 } // raw angle ≈ 42.1°, delta от 45° ≈ 2.9° — внутри порога
    const edge = buildDraftEdge(ORIGIN, cursor, POLAR, DEFAULT_SNAP_CONFIG)
    expect(edge.dir.snapped).toBe(true)
    expect(edge.dir.snapAngle).toBe(45)
    // `to` должен лежать НА луче 45°, то есть to.x ≈ to.y (с учётом того, что from = origin)
    expect(edge.to.x).toBeCloseTo(edge.to.y, 8)
    // и не должен совпадать с сырым курсором (105, 95) — это и есть суть привязки
    expect(edge.to.x).not.toBeCloseTo(105, 3)
  })

  it('from is passed through unchanged', () => {
    const from: Point = { x: 12, y: -8 }
    const edge = buildDraftEdge(from, { x: 50, y: -8 }, FREE, DEFAULT_SNAP_CONFIG)
    expect(edge.from).toEqual(from)
  })
})

describe('finalizeDraftEdge (A1 — оверрайд длины/угла из буфера динамического ввода)', () => {
  function mouseEdge(): DraftEdge {
    // Мышиный черновик: from=(0,0), угол 0° (вправо), длина 100.
    return buildDraftEdge({ x: 0, y: 0 }, { x: 100, y: 0 }, FREE, DEFAULT_SNAP_CONFIG)
  }

  it('без override возвращает исходный edge как есть (та же ссылка)', () => {
    const edge = mouseEdge()
    expect(finalizeDraftEdge(edge, undefined)).toBe(edge)
    expect(finalizeDraftEdge(edge, {})).toBe(edge)
  })

  it('оверрайд только длины: направление остаётся мышиным, длина — из override', () => {
    const edge = mouseEdge()
    const finalized = finalizeDraftEdge(edge, { lengthMm: 5800 })
    expect(distance(finalized.from, finalized.to)).toBeCloseTo(5800, 6)
    expect(finalized.dir.angleDeg).toBeCloseTo(0, 6) // угол не тронут
    expect(finalized.to.y).toBeCloseTo(0, 6) // всё ещё вдоль исходного луча
  })

  it('оверрайд только угла: длина остаётся мышиной, направление — из override', () => {
    const edge = mouseEdge() // длина 100
    const finalized = finalizeDraftEdge(edge, { angleDeg: 66 })
    expect(distance(finalized.from, finalized.to)).toBeCloseTo(100, 6)
    expect(finalized.dir.angleDeg).toBe(66)
  })

  it('оверрайд длины и угла одновременно', () => {
    const edge = mouseEdge()
    const finalized = finalizeDraftEdge(edge, { lengthMm: 6249, angleDeg: 66 })
    expect(distance(finalized.from, finalized.to)).toBeCloseTo(6249, 6)
    expect(finalized.dir.angleDeg).toBe(66)
  })

  it('dir.snapped сохраняется из исходного edge независимо от override', () => {
    const snappedEdge = buildDraftEdge({ x: 0, y: 0 }, { x: 100, y: 2 }, { lockOrtho: true, freeform: false }, DEFAULT_SNAP_CONFIG)
    expect(snappedEdge.dir.snapped).toBe(true)
    const finalized = finalizeDraftEdge(snappedEdge, { lengthMm: 1234 })
    expect(finalized.dir.snapped).toBe(true)
  })

  it('closesContour сохраняется, а `to` пересчитывается от from+угол+длина, а не клонируется из magnet-снапнутого to', () => {
    const closingEdge: DraftEdge = {
      from: { x: 0, y: 0 },
      to: { x: 500, y: 0 }, // допустим магнит "прилипил" сюда, к startPoint
      dir: { angleDeg: 0, snapped: true, snapAngle: 0 },
      closesContour: true,
    }
    // Пользователь печатает РЕАЛЬНУЮ измеренную длину, отличную от magnet-to —
    // честная невязка, а не молчаливая подмена на geometрически "красивое" замыкание.
    const finalized = finalizeDraftEdge(closingEdge, { lengthMm: 520 })
    expect(finalized.closesContour).toBe(true)
    expect(distance(finalized.from, finalized.to)).toBeCloseTo(520, 6)
    expect(finalized.to).not.toEqual({ x: 500, y: 0 })
  })
})
