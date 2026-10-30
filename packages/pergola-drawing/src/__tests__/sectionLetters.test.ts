import { describe, expect, it } from 'vitest'
import { placeSectionLetters, type ScreenCell } from '../sectionLetters'

function cell(id: string, cx: number, cy: number, w: number, h: number): ScreenCell {
  return { id, cx, cy, left: cx - w / 2, right: cx + w / 2, top: cy - h / 2, bottom: cy + h / 2 }
}

describe('placeSectionLetters', () => {
  it('keeps one baseline for a row and moves only a letter that covers a dimension', () => {
    const cells = [
      cell('a1', 100, 80, 80, 70),
      cell('a2', 200, 82, 80, 70),
      cell('b1', 100, 220, 80, 90),
      cell('c', 200, 224, 70, 90),
    ]
    const placed = placeSectionLetters(cells, [{ x: 100, y: 81, halfW: 12, halfH: 10 }], () => 16)
    const rowA = placed.filter((letter) => letter.id.startsWith('a'))
    expect(rowA[0].y).toBeCloseTo(rowA[1].y, 5)
    expect(rowA[1].x).toBeCloseTo(200, 5)
    expect(Math.abs(rowA[0].x - 100)).toBeGreaterThan(8)
    const lower = placed.filter((letter) => letter.id === 'b1' || letter.id === 'c')
    expect(lower[0].y).toBeCloseTo(lower[1].y, 5)
    expect(lower.every((letter) => letter.y > 150)).toBe(true)
    for (const letter of placed) {
      const source = cells.find((item) => item.id === letter.id)
      expect(letter.x).toBeGreaterThan((source?.left ?? 0) + 8)
      expect(letter.x).toBeLessThan((source?.right ?? 0) - 8)
    }
  })
})
