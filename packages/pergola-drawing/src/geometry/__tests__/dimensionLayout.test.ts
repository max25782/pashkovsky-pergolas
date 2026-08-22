import { describe, it, expect } from 'vitest'
import { outwardNormal, buildDimensionLineLayout } from '../dimensionLayout'
import type { AxialDimensionChain } from '@pashkovsky/pergola-core'
import type { Point2D } from '@pashkovsky/pergola-core'

const near = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps)

describe('outwardNormal', () => {
  it('bottom edge of a rectangle (centroid above it): outward normal points DOWN (-y)', () => {
    const A: Point2D = [0, 0]
    const B: Point2D = [1000, 0]
    const centroid: Point2D = [500, 500]
    const n = outwardNormal(A, B, centroid)
    near(n[0], 0)
    near(n[1], -1)
  })

  it('right edge of a rectangle (centroid to the left): outward normal points RIGHT (+x)', () => {
    const A: Point2D = [1000, 0]
    const B: Point2D = [1000, 1000]
    const centroid: Point2D = [500, 500]
    const n = outwardNormal(A, B, centroid)
    near(n[0], 1)
    near(n[1], 0)
  })

  it('is always a unit vector', () => {
    const n = outwardNormal([0, 0], [300, 400], [1000, 1000])
    near(Math.hypot(n[0], n[1]), 1)
  })
})

describe('buildDimensionLineLayout', () => {
  const chain: AxialDimensionChain = {
    edgeIndex: 0,
    beamId: 'beam-0',
    points: [
      { distanceFromStartMm: 0, point: [0, 0], kind: 'corner' },
      { distanceFromStartMm: 2000, point: [2000, 0], kind: 'post', postId: 'post-a' },
      { distanceFromStartMm: 4000, point: [4000, 0], kind: 'post', postId: 'post-b' },
      { distanceFromStartMm: 6000, point: [6000, 0], kind: 'corner' },
    ],
    segmentsMm: [2000, 2000, 2000],
  }

  it('one extension line per chain point, running outward by offsetMm', () => {
    const layout = buildDimensionLineLayout(chain, [0, -1], 300)
    expect(layout.extensionLines).toHaveLength(4)
    layout.extensionLines.forEach((ext, i) => {
      expect(ext.from).toEqual(chain.points[i].point)
      near(ext.to[0], chain.points[i].point[0])
      near(ext.to[1], chain.points[i].point[1] - 300)
    })
  })

  it('one segment per consecutive pair of chain points, lengths match chain.segmentsMm', () => {
    const layout = buildDimensionLineLayout(chain, [0, -1], 300)
    expect(layout.segments).toHaveLength(3)
    layout.segments.forEach((seg, i) => {
      near(seg.lengthMm, chain.segmentsMm[i])
    })
  })

  it('segment offset points lie exactly on the offset line (constant perpendicular offset)', () => {
    const layout = buildDimensionLineLayout(chain, [0, -1], 300)
    for (const seg of layout.segments) {
      near(seg.fromOffsetPoint[1], -300)
      near(seg.toOffsetPoint[1], -300)
    }
  })

  it('label anchor is the midpoint of the offset segment', () => {
    const layout = buildDimensionLineLayout(chain, [0, -1], 300)
    near(layout.segments[0].labelAnchor[0], 1000)
    near(layout.segments[0].labelAnchor[1], -300)
  })

  it('preserves edgeIndex from the source chain', () => {
    const layout = buildDimensionLineLayout({ ...chain, edgeIndex: 3 }, [0, -1], 300)
    expect(layout.edgeIndex).toBe(3)
  })
})
