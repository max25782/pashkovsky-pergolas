import { describe, expect, it } from 'vitest'
import type { Point2D, TopPlanDimensionModel } from '@pashkovsky/pergola-core'
import { angleLabelWorldPoint, renderPlanDimensionsSvg } from '../planDimensionsSvg'

describe('angle labels stay on the sheet', () => {
  it('places the label toward the centroid, not off the right edge', () => {
    const vertex: Point2D = [6000, 3000]
    const label = angleLabelWorldPoint(vertex, [6000, 0], [0, 3000], [3000, 1500])
    expect(label[0]).toBeLessThan(vertex[0] - 200)
  })

  it('leaves room in the viewBox for the angle glyphs', () => {
    const contour: Point2D[] = [[0, 0], [6000, 0], [6000, 3000], [0, 3000]]
    const model: TopPlanDimensionModel = {
      perimeterChains: [],
      purlinClearChain: null,
      purlinClearVerification: null,
      purlinClearDisplaySummary: null,
      vertexAngles: contour.map((vertex, vertexIndex) => ({
        vertexIndex,
        vertex,
        interiorAngleDeg: vertexIndex === 1 ? 92.5 : 90,
      })),
    }
    const svg = renderPlanDimensionsSvg({
      contour,
      model,
      geometricSides: [],
      centroid: [3000, 1500],
      lamellaDirectionDeg: 0,
    })
    const box = svg.match(/viewBox="0 0 ([0-9.]+) ([0-9.]+)"/)
    expect(box).not.toBeNull()
    const width = Number(box![1])
    const height = Number(box![2])
    const labels = [...svg.matchAll(/<text x="([0-9.]+)" y="([0-9.]+)"[^>]*>([0-9.]+)°<\/text>/g)]
    expect(labels.length).toBe(4)
    for (const label of labels) {
      const x = Number(label[1])
      const y = Number(label[2])
      const half = label[3].length * 180 * 0.6
      expect(x - half).toBeGreaterThan(0)
      expect(x + half).toBeLessThan(width)
      expect(y - 180).toBeGreaterThan(0)
      expect(y + 180).toBeLessThan(height)
    }
  })
})
