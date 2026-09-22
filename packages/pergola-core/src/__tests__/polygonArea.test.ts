import { describe, expect, it } from 'vitest'
import { polygonAreaM2 } from '../polygonArea'

describe('polygonAreaM2', () => {
  it('rectangle 4000×6000 mm → 24 m²', () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 6000 },
      { x: 0, y: 6000 },
    ]
    expect(polygonAreaM2(polygon)).toBe(24)
  })

  it('L-shape with cutout is smaller than axis-aligned bounding box', () => {
    const lShape = [
      { x: 0, y: 0 },
      { x: 6000, y: 0 },
      { x: 6000, y: 3000 },
      { x: 3000, y: 3000 },
      { x: 3000, y: 6000 },
      { x: 0, y: 6000 },
    ]
    const area = polygonAreaM2(lShape)
    const bboxArea = (6000 * 6000) / 1_000_000
    const cutout = (3000 * 3000) / 1_000_000
    expect(area).toBe(bboxArea - cutout)
    expect(area).toBeLessThan(bboxArea)
  })

  it('clockwise vs counter-clockwise → same area', () => {
    const ccw = [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 6000 },
      { x: 0, y: 6000 },
    ]
    const cw = [...ccw].reverse()
    expect(polygonAreaM2(cw)).toBe(polygonAreaM2(ccw))
  })
})
