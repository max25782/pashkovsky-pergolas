import { describe, it, expect } from 'vitest'
import { pieceAxis } from '../pieceAxis'
import type { CutPiece } from '../types'

const DEG = Math.PI / 180

function piece(overrides: Partial<CutPiece>): CutPiece {
  return {
    id: 'p-0',
    role: 'beam',
    profileId: 'prof',
    lengthAxisMm: 1000,
    lengthLongMm: 1000,
    lengthShortMm: 1000,
    cutMiterStartDeg: 0,
    cutBevelStartDeg: 0,
    cutHandStart: 'straight',
    cutMiterEndDeg: 0,
    cutBevelEndDeg: 0,
    cutHandEnd: 'straight',
    position: [0, 2600, 0],
    rotation: [0, 0, 0],
    color: '#fff',
    ...overrides,
  }
}

const near = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps)

describe('pieceAxis', () => {
  it('post: axis is a single point, equal to (position[0], position[2]) — no direction to derive', () => {
    const post = piece({ role: 'post', position: [1234, 0, 5678], rotation: [0, 0, 0], lengthAxisMm: 2600 })
    const axis = pieceAxis(post)
    expect(axis.start).toEqual([1234, 5678])
    expect(axis.end).toEqual(axis.start)
  })

  it('beam along +X (θ=0): axis runs from position to position + (lengthAxisMm, 0)', () => {
    const beam = piece({ role: 'beam', position: [100, 2600, 200], rotation: [0, 0, 0], lengthAxisMm: 3000 })
    const { start, end } = pieceAxis(beam)
    expect(start).toEqual([100, 200])
    near(end[0], 3100)
    near(end[1], 200)
  })

  it('beam along +Y (θ=90°, rotation.y=-90°): axis runs from position to position + (0, lengthAxisMm)', () => {
    const beam = piece({ role: 'beam', position: [100, 2600, 200], rotation: [0, -90 * DEG, 0], lengthAxisMm: 3000 })
    const { start, end } = pieceAxis(beam)
    expect(start).toEqual([100, 200])
    near(end[0], 100)
    near(end[1], 3200)
  })

  it('beam at an oblique angle (θ=37°): matches cos/sin projection exactly', () => {
    const thetaDeg = 37
    const beam = piece({ role: 'beam', position: [0, 2600, 0], rotation: [0, -thetaDeg * DEG, 0], lengthAxisMm: 5000 })
    const { start, end } = pieceAxis(beam)
    expect(start).toEqual([0, 0])
    near(end[0], 5000 * Math.cos(thetaDeg * DEG))
    near(end[1], 5000 * Math.sin(thetaDeg * DEG))
  })

  it('purlin: same convention as beam (role does not matter, only rotation.y and lengthAxisMm)', () => {
    const purlin = piece({ role: 'purlin', position: [500, 2600, 500], rotation: [0, -90 * DEG, 0], lengthAxisMm: 3000 })
    const { start, end } = pieceAxis(purlin)
    expect(start).toEqual([500, 500])
    near(end[0], 500)
    near(end[1], 3500)
  })

  it('lamella with a nonzero tilt (rotation.x !== 0, lamellaOnEdge/lamellaAngleDeg): plan axis is UNAFFECTED by tilt — only rotation.y and lengthAxisMm matter', () => {
    const flat = piece({ role: 'lamella', position: [0, 2600, 0], rotation: [0, -45 * DEG, 0], lengthAxisMm: 2000 })
    const tilted = piece({ role: 'lamella', position: [0, 2600, 0], rotation: [30 * DEG, -45 * DEG, 0], lengthAxisMm: 2000 })
    const axisFlat = pieceAxis(flat)
    const axisTilted = pieceAxis(tilted)
    near(axisFlat.end[0], axisTilted.end[0])
    near(axisFlat.end[1], axisTilted.end[1])
    near(axisTilted.end[0], 2000 * Math.cos(45 * DEG))
    near(axisTilted.end[1], 2000 * Math.sin(45 * DEG))
  })

  it('zero-length piece: start === end (degenerate, but well-defined)', () => {
    const p = piece({ role: 'beam', position: [10, 2600, 20], rotation: [0, -12 * DEG, 0], lengthAxisMm: 0 })
    const { start, end } = pieceAxis(p)
    near(end[0], start[0])
    near(end[1], start[1])
  })
})
