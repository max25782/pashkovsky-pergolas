export interface ScreenCell {
  id: string
  cx: number
  cy: number
  left: number
  right: number
  top: number
  bottom: number
}

export interface ScreenLabelBox {
  x: number
  y: number
  halfW: number
  halfH: number
}

function overlaps(x: number, y: number, halfW: number, halfH: number, label: ScreenLabelBox): boolean {
  return Math.abs(x - label.x) < halfW + label.halfW && Math.abs(y - label.y) < halfH + label.halfH
}

/**
 * Letters sit on the center of the cell and share one baseline per row.
 * A letter moves only when its box actually covers a dimension label, and
 * only sideways, inside the cell, clear of the divider.
 */
export function placeSectionLetters(
  cells: ScreenCell[],
  labels: ScreenLabelBox[],
  fontSizeFor: (cell: ScreenCell) => number,
  interior?: { x: number; y: number },
): Array<{ id: string; x: number; y: number }> {
  const rows: ScreenCell[][] = []
  const sorted = [...cells].sort((a, b) => a.cy - b.cy || a.cx - b.cx)
  for (const cell of sorted) {
    const height = Math.max(1, cell.bottom - cell.top)
    const row = rows.find((group) => {
      const groupHeight = Math.max(1, group[0].bottom - group[0].top)
      return Math.abs(group[0].cy - cell.cy) < Math.min(height, groupHeight) * 0.45
    })
    if (row) row.push(cell)
    else rows.push([cell])
  }
  const placed: Array<{ id: string; x: number; y: number }> = []
  for (const row of rows) {
    const y = row.reduce((sum, cell) => sum + cell.cy, 0) / row.length
    for (const cell of row) {
      const font = fontSizeFor(cell)
      const halfW = font * 0.55
      const halfH = font * 0.65
      let x = cell.cx
      let letterY = y
      const hits = (px: number, py = letterY) => labels.some((label) => overlaps(px, py, halfW, halfH, label))
      const narrow = Math.min(cell.right - cell.left, cell.bottom - cell.top)
      if (interior && narrow < font * 2.4) {
        let vx = interior.x - cell.cx
        let vy = interior.y - cell.cy
        const vlen = Math.hypot(vx, vy) || 1
        vx /= vlen
        vy /= vlen
        const maxReach = Math.max(0, narrow / 2 - Math.max(halfW, halfH) - 1)
        for (const extra of [6, 12, 18]) {
          const reach = Math.min(maxReach, extra)
          if (reach < 2) break
          const ox = cell.cx + vx * reach
          const oy = cell.cy + vy * reach
          if (hits(ox, oy)) continue
          x = ox
          letterY = oy
          break
        }
      }
        if (hits(x, letterY)) {
          const minX = cell.left + 10 + halfW
          const maxX = cell.right - 10 - halfW
          let best = x
          let bestDist = Infinity
          if (maxX > minX) {
            for (let candidate = minX; candidate <= maxX; candidate += 2) {
              if (hits(candidate, letterY)) continue
              const dist = Math.abs(candidate - cell.cx)
              if (dist < bestDist) {
                bestDist = dist
                best = candidate
              }
            }
          }
          x = best
        }
        placed.push({ id: cell.id, x, y: letterY })
    }
  }
  return placed
}
