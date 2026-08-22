import { describe, it, expect } from 'vitest'
import { groupBeamsIntoGeometricSides } from '../beamRuns'
import type { CutPiece } from '@pashkovsky/pergola-core'

/**
 * See prompt "дважды приняли артефакт презентации за баг расчёта" — this
 * file exercises exactly the bug: a polygon side that has been cut into
 * several stock-length beam pieces (see segmentBeamsForStock) must still
 * collapse back into ONE geometric side for dimensioning purposes, while a
 * real corner (direction actually changes) must NOT collapse.
 */
function beamPiece(overrides: Partial<CutPiece> = {}): CutPiece {
  return {
    id: 'beam-0',
    role: 'beam',
    profileId: 'f10040',
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

const near = (a: number, b: number, eps = 1e-3) => expect(Math.abs(a - b)).toBeLessThan(eps)

describe('groupBeamsIntoGeometricSides', () => {
  it('unsegmented rectangle: one side per beam, unchanged', () => {
    // (0,0)->(6000,0)->(6000,3000)->(0,3000)->(0,0), 4 beams, one per edge.
    const beams = [
      beamPiece({ id: 'beam-0', position: [0, 2600, 0], rotation: [0, 0, 0], lengthAxisMm: 6000 }),
      beamPiece({ id: 'beam-1', position: [6000, 2600, 0], rotation: [0, -Math.PI / 2, 0], lengthAxisMm: 3000 }),
      beamPiece({ id: 'beam-2', position: [6000, 2600, 3000], rotation: [0, Math.PI, 0], lengthAxisMm: 6000 }),
      beamPiece({ id: 'beam-3', position: [0, 2600, 3000], rotation: [0, Math.PI / 2, 0], lengthAxisMm: 3000 }),
    ]
    const sides = groupBeamsIntoGeometricSides(beams)
    expect(sides).toHaveLength(4)
    expect(sides.map((s) => s.id)).toEqual(['beam-0', 'beam-1', 'beam-2', 'beam-3'])
    near(sides[0].start[0], 0)
    near(sides[0].end[0], 6000)
  })

  it('one side split into 2 stock-length segments: collapses back into ONE side, no phantom corner at the splice', () => {
    // Top edge (0,0)->(9310.5,0) cut into two collinear pieces at x=4232.37,
    // matching the exact real-session numbers from the sliver bug report.
    const beams = [
      beamPiece({ id: 'beam-2-seg0', position: [0, 2600, 0], rotation: [0, 0, 0], lengthAxisMm: 4232.37 }),
      beamPiece({ id: 'beam-2-seg1', position: [4232.37, 2600, 0], rotation: [0, 0, 0], lengthAxisMm: 5078.13 }),
    ]
    const sides = groupBeamsIntoGeometricSides(beams)
    expect(sides).toHaveLength(1)
    expect(sides[0].id).toBe('beam-2-seg0')
    near(sides[0].start[0], 0)
    near(sides[0].start[1], 0)
    near(sides[0].end[0], 9310.5)
    near(sides[0].end[1], 0)
  })

  it('one side split into 3 stock-length segments: still ONE side end to end', () => {
    const beams = [
      beamPiece({ id: 'b-seg0', position: [0, 2600, 0], rotation: [0, 0, 0], lengthAxisMm: 3000 }),
      beamPiece({ id: 'b-seg1', position: [3000, 2600, 0], rotation: [0, 0, 0], lengthAxisMm: 3000 }),
      beamPiece({ id: 'b-seg2', position: [6000, 2600, 0], rotation: [0, 0, 0], lengthAxisMm: 3310.5 }),
    ]
    const sides = groupBeamsIntoGeometricSides(beams)
    expect(sides).toHaveLength(1)
    near(sides[0].start[0], 0)
    near(sides[0].end[0], 9310.5)
  })

  it('a real corner (direction changes) is NOT collapsed, even though endpoints touch exactly', () => {
    const beams = [
      beamPiece({ id: 'beam-a', position: [0, 2600, 0], rotation: [0, 0, 0], lengthAxisMm: 4232.37 }),
      // Turns 90°: continues from beam-a's end point but perpendicular — a real polygon corner.
      beamPiece({ id: 'beam-b', position: [4232.37, 2600, 0], rotation: [0, -Math.PI / 2, 0], lengthAxisMm: 3000 }),
    ]
    const sides = groupBeamsIntoGeometricSides(beams)
    expect(sides).toHaveLength(2)
    expect(sides.map((s) => s.id)).toEqual(['beam-a', 'beam-b'])
  })

  it('L-shape with the long edge segmented: 6 geometric sides total, matching the 6 polygon edges', () => {
    // (0,0)->(9310.5,0)[segmented into 2]->(9310.5,2696.5)->(5150.8,2696.5)
    //      ->(5150.8,-4402.5)->(-145.3,-4402.5)->(0,0)  — six real edges.
    const beams = [
      beamPiece({ id: 'top-seg0', position: [0, 2600, 0], rotation: [0, 0, 0], lengthAxisMm: 4232.37 }),
      beamPiece({ id: 'top-seg1', position: [4232.37, 2600, 0], rotation: [0, 0, 0], lengthAxisMm: 5078.13 }),
      beamPiece({ id: 'right', position: [9310.5, 2600, 0], rotation: [0, -1.570796, 0], lengthAxisMm: 2696.49 }),
      beamPiece({ id: 'notch-h', position: [9310.5, 2600, 2696.49], rotation: [0, -3.141593, 0], lengthAxisMm: 4159.7 }),
      beamPiece({ id: 'notch-v', position: [5150.8, 2600, 2696.49], rotation: [0, 1.570796, 0], lengthAxisMm: 7099.02 }),
      beamPiece({ id: 'bottom', position: [5150.8, 2600, -4402.53], rotation: [0, -3.141593, 0], lengthAxisMm: 5296.14 }),
      beamPiece({ id: 'closing', position: [-145.34, 2600, -4402.53], rotation: [0, -1.537795, 0], lengthAxisMm: 4404.93 }),
    ]
    const sides = groupBeamsIntoGeometricSides(beams)
    expect(sides).toHaveLength(6)
    expect(sides.map((s) => s.id)).toEqual([
      'top-seg0', 'right', 'notch-h', 'notch-v', 'bottom', 'closing',
    ])
  })

  it('empty input: no sides, no crash', () => {
    expect(groupBeamsIntoGeometricSides([])).toEqual([])
  })

  it('single unsegmented beam: one side', () => {
    const sides = groupBeamsIntoGeometricSides([beamPiece({ id: 'only' })])
    expect(sides).toHaveLength(1)
    expect(sides[0].id).toBe('only')
  })
})
