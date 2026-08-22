import { describe, it, expect } from 'vitest'
import { groupLamellaRows, buildLamellaRhythm } from '../lamellaRhythm'
import type { CutPiece, ProfileDimensions } from '@pashkovsky/pergola-core'

/**
 * Builds a synthetic lamella row the way computeLamellas actually would:
 * axis running along +X (rotation.y = 0), row positioned at scanCoordinateMm
 * along +Z (perpendicular axis) — see lamellas.ts `position: [startPt[0],
 * heightMm, startPt[1]]` and `rotation: [tilt, −θ, 0]`.
 */
function row(profileId: string, scanCoordinateMm: number, id: string): CutPiece {
  return {
    id,
    role: 'lamella',
    profileId,
    lengthAxisMm: 3000,
    lengthLongMm: 3000,
    lengthShortMm: 3000,
    cutMiterStartDeg: 0,
    cutBevelStartDeg: 0,
    cutHandStart: 'straight',
    cutMiterEndDeg: 0,
    cutBevelEndDeg: 0,
    cutHandEnd: 'straight',
    position: [0, 2600, scanCoordinateMm],
    rotation: [0, 0, 0], // θ = 0 → dir = +X, perp = +Z
    color: '#fff',
  }
}

const near = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps)

describe('groupLamellaRows', () => {
  it('groups two segments of the SAME scan line into one row, and sorts rows ascending', () => {
    const a1 = row('lam-40', 500, 'a1')
    const a2 = row('lam-40', 500, 'a2') // second segment of the same row (e.g. L-shape or purlin split)
    const b = row('lam-40', 100, 'b')
    const rows = groupLamellaRows([a1, b, a2])
    expect(rows).toHaveLength(2)
    expect(rows[0].scanCoordinateMm).toBe(100)
    expect(rows[1].scanCoordinateMm).toBe(500)
    expect(rows[1].pieces).toHaveLength(2)
  })

  it('empty input → []', () => {
    expect(groupLamellaRows([])).toEqual([])
  })
})

describe('buildLamellaRhythm — uniform pattern', () => {
  const profile: ProfileDimensions = { widthMm: 40, heightMm: 20 }
  const profiles = new Map([['lam-40', profile]])

  it('pitch=60 (width 40 + gap 20) → gap recovered exactly as 20', () => {
    const pieces = [row('lam-40', 40, 'r0'), row('lam-40', 100, 'r1'), row('lam-40', 160, 'r2')]
    const { segments } = buildLamellaRhythm(pieces, profiles, false)
    expect(segments).toHaveLength(2)
    for (const seg of segments) {
      near(seg.pitchMm, 60)
      near(seg.gapMm, 20)
    }
  })

  it('lamellaOnEdge=true: visible width switches to heightMm (20) — same pitch now reads as an 40mm gap', () => {
    const pieces = [row('lam-40', 30, 'r0'), row('lam-40', 70, 'r1')]
    const { segments } = buildLamellaRhythm(pieces, profiles, true)
    expect(segments).toHaveLength(1)
    near(segments[0].pitchMm, 40)
    near(segments[0].gapMm, 40 - 20) // pitch − heightMm(=visible) → 20
  })
})

describe('buildLamellaRhythm — mixed pattern (70/40/20)', () => {
  const wide: ProfileDimensions = { widthMm: 70, heightMm: 20 }
  const mid: ProfileDimensions = { widthMm: 40, heightMm: 20 }
  const thin: ProfileDimensions = { widthMm: 20, heightMm: 20 }
  const profiles = new Map([['wide', wide], ['mid', mid], ['thin', thin]])

  it('alternating widths at gap=20: each segment recovers gap=20 even though pitch varies row to row', () => {
    // spacing(wide→mid) = 35+20+20=75; spacing(mid→thin)=20+20+10=50; spacing(thin→wide)=10+20+35=65
    const pieces = [
      row('wide', 35, 'r0'),
      row('mid', 35 + 75, 'r1'),
      row('thin', 35 + 75 + 50, 'r2'),
      row('wide', 35 + 75 + 50 + 65, 'r3'),
    ]
    const { segments } = buildLamellaRhythm(pieces, profiles, false)
    expect(segments).toHaveLength(3)
    near(segments[0].pitchMm, 75)
    near(segments[1].pitchMm, 50)
    near(segments[2].pitchMm, 65)
    for (const seg of segments) near(seg.gapMm, 20)
  })
})
