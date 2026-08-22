import { describe, it, expect } from 'vitest'
import { beamFootprintCorners, postFootprintCorners, lamellaFootprintCorners } from '../footprints'
import type { CutPiece, ProfileDimensions } from '@pashkovsky/pergola-core'

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

const near = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps)

describe('beamFootprintCorners', () => {
  it('beam along +X: footprint is a widthMm-tall rectangle straddling the axis (Y in plan)', () => {
    const beam = beamPiece({ position: [0, 2600, 0], rotation: [0, 0, 0], lengthAxisMm: 1000 })
    const profile: ProfileDimensions = { widthMm: 40, heightMm: 100 }
    const corners = beamFootprintCorners(beam, profile)
    expect(corners).toHaveLength(4)
    // All corners at x=0 or x=1000, y=+-20
    const xs = corners.map((c) => c[0]).sort((a, b) => a - b)
    const ys = corners.map((c) => c[1]).sort((a, b) => a - b)
    near(xs[0], 0)
    near(xs[3], 1000)
    near(ys[0], -20)
    near(ys[3], 20)
  })

  it('footprint width matches profile.widthMm regardless of profile.heightMm', () => {
    const beam = beamPiece({ position: [0, 2600, 0], rotation: [0, 0, 0], lengthAxisMm: 500 })
    const narrow = beamFootprintCorners(beam, { widthMm: 40, heightMm: 100 })
    const wide = beamFootprintCorners(beam, { widthMm: 40, heightMm: 9999 })
    // heightMm must not affect the plan footprint at all
    expect(narrow).toEqual(wide)
  })

  it('rotated beam (θ=90°): footprint rectangle rotates with the axis, corners stay equidistant from the axis line', () => {
    const beam = beamPiece({ position: [0, 2600, 0], rotation: [0, -Math.PI / 2, 0], lengthAxisMm: 1000 })
    const profile: ProfileDimensions = { widthMm: 40, heightMm: 100 }
    const corners = beamFootprintCorners(beam, profile)
    for (const [x] of corners) near(Math.abs(x), 20)
  })
})

describe('lamellaFootprintCorners', () => {
  it('flat (lamellaOnEdge=false): footprint width is profile.widthMm, matching computeLamellas\' own visibleWidthMm', () => {
    const lamella = beamPiece({ role: 'lamella', position: [0, 2600, 0], rotation: [0, 0, 0], lengthAxisMm: 1000 })
    const profile: ProfileDimensions = { widthMm: 40, heightMm: 20 }
    const corners = lamellaFootprintCorners(lamella, profile, false)
    const ys = corners.map((c) => c[1]).sort((a, b) => a - b)
    near(ys[0], -20)
    near(ys[3], 20)
  })

  it('on edge (lamellaOnEdge=true): footprint width switches to profile.heightMm — matches lamellaPattern.ts resolveLamellaPattern', () => {
    const lamella = beamPiece({ role: 'lamella', position: [0, 2600, 0], rotation: [0, 0, 0], lengthAxisMm: 1000 })
    const profile: ProfileDimensions = { widthMm: 40, heightMm: 20 }
    const corners = lamellaFootprintCorners(lamella, profile, true)
    const ys = corners.map((c) => c[1]).sort((a, b) => a - b)
    near(ys[0], -10)
    near(ys[3], 10)
  })
})

describe('postFootprintCorners', () => {
  it('square post: footprint is a square of side widthMm centred on the post point', () => {
    const post: CutPiece = {
      id: 'post-0',
      role: 'post',
      profileId: 'f8080',
      lengthAxisMm: 2600,
      lengthLongMm: 2600,
      lengthShortMm: 2600,
      cutMiterStartDeg: 0,
      cutBevelStartDeg: 0,
      cutHandStart: 'straight',
      cutMiterEndDeg: 0,
      cutBevelEndDeg: 0,
      cutHandEnd: 'straight',
      position: [500, 0, 300],
      rotation: [0, 0, 0],
      color: '#fff',
    }
    const profile: ProfileDimensions = { widthMm: 80, heightMm: 80 }
    const corners = postFootprintCorners(post, profile)
    const xs = corners.map((c) => c[0])
    const ys = corners.map((c) => c[1])
    expect(Math.min(...xs)).toBeCloseTo(460)
    expect(Math.max(...xs)).toBeCloseTo(540)
    expect(Math.min(...ys)).toBeCloseTo(260)
    expect(Math.max(...ys)).toBeCloseTo(340)
  })

  it('rectangular post (100×40): footprint is heightMm × widthMm (world X × world Z) — see geometryBuilder rotateZ derivation', () => {
    const post: CutPiece = {
      id: 'post-1',
      role: 'post',
      profileId: 'f10040',
      lengthAxisMm: 2600,
      lengthLongMm: 2600,
      lengthShortMm: 2600,
      cutMiterStartDeg: 0,
      cutBevelStartDeg: 0,
      cutHandStart: 'straight',
      cutMiterEndDeg: 0,
      cutBevelEndDeg: 0,
      cutHandEnd: 'straight',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      color: '#fff',
    }
    const profile: ProfileDimensions = { widthMm: 40, heightMm: 100 }
    const corners = postFootprintCorners(post, profile)
    const xs = corners.map((c) => c[0])
    const ys = corners.map((c) => c[1])
    near(Math.max(...xs) - Math.min(...xs), 100) // heightMm along world X
    near(Math.max(...ys) - Math.min(...ys), 40) // widthMm along world Z
  })
})
