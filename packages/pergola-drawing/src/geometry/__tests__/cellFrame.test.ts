import { describe, it, expect } from 'vitest'
import { buildCellFrameGeometry, pickRepresentativeLamella } from '../cellFrame'
import type { CutPiece } from '@pashkovsky/pergola-core'

function lamella(overrides: Partial<CutPiece> = {}): CutPiece {
  return {
    id: 'lam-0',
    role: 'lamella',
    profileId: 'lam-40',
    lengthAxisMm: 1970,
    lengthLongMm: 1970,
    lengthShortMm: 1970,
    cutMiterStartDeg: 0,
    cutBevelStartDeg: 0,
    cutHandStart: 'straight',
    cutMiterEndDeg: 0,
    cutBevelEndDeg: 0,
    cutHandEnd: 'straight',
    position: [0, 2600, 0],
    rotation: [0, 0, 0], // axis along +X
    color: '#fff',
    ...overrides,
  }
}

const near = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps)

describe('buildCellFrameGeometry', () => {
  it('reconstructs the raw (pre-vистур) opening from the already-reduced piece length: 1970 + 30 = 2000', () => {
    const piece = lamella({ lengthAxisMm: 1970 })
    const geo = buildCellFrameGeometry(piece, 30)
    near(geo.reducedLengthMm, 1970)
    near(geo.rawOpeningMm, 2000)
    near(geo.reductionPerEndMm, 15)
  })

  it('extends the raw endpoints 15mm beyond each reduced end, along the piece axis', () => {
    const piece = lamella({ lengthAxisMm: 1970, position: [100, 2600, 0], rotation: [0, 0, 0] })
    const geo = buildCellFrameGeometry(piece, 30)
    // Axis along +X: reducedStart=[100,0], reducedEnd=[100+1970,0]=[2070,0]
    near(geo.reducedStart[0], 100)
    near(geo.reducedEnd[0], 2070)
    near(geo.rawStart[0], 100 - 15)
    near(geo.rawEnd[0], 2070 + 15)
    // Y (perpendicular) is untouched by the extension.
    near(geo.rawStart[1], 0)
    near(geo.rawEnd[1], 0)
  })

  it('lengthReductionTotalMm=0 → raw === reduced exactly (no vistur clearance was ever applied)', () => {
    const piece = lamella({ lengthAxisMm: 3000 })
    const geo = buildCellFrameGeometry(piece, 0)
    near(geo.rawOpeningMm, 3000)
    expect(geo.rawStart).toEqual(geo.reducedStart)
    expect(geo.rawEnd).toEqual(geo.reducedEnd)
  })
})

describe('pickRepresentativeLamella', () => {
  it('picks the longest piece', () => {
    const pieces = [lamella({ id: 'a', lengthAxisMm: 1000 }), lamella({ id: 'b', lengthAxisMm: 3000 }), lamella({ id: 'c', lengthAxisMm: 2000 })]
    expect(pickRepresentativeLamella(pieces)?.id).toBe('b')
  })

  it('empty input → null', () => {
    expect(pickRepresentativeLamella([])).toBeNull()
  })
})
