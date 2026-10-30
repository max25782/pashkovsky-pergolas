/**
 * Screen-space clearance for plan labels.
 * Moves a label along its nudge. Never changes width, height, or font size.
 */

export interface ScreenLabel {
  id: string
  x: number
  y: number
  w: number
  h: number
  /** When set, other labels move away and this one stays. */
  locked?: boolean
  /** Unit vector. Dimension labels step outward; angles step further inside. */
  nudge: { x: number; y: number }
  /**
   * Beam-number circles. A hit moves this box along the beam.
   * Dimension labels stay where they are.
   */
  slide?: { x: number; y: number }
  /** Beam segment in screen space. The circle may move only between these ends. */
  slideFrom?: { x: number; y: number }
  slideTo?: { x: number; y: number }
  /** Where a miter label started, next to its vertex. It may not travel far from here. */
  origin?: { x: number; y: number }
  /** Vertex the leader points at when the label had to move. */
  leaderTo?: { x: number; y: number }
}

export interface ScreenSegment {
  x1: number
  y1: number
  x2: number
  y2: number
  /** Label that owns this measured line may sit beside it. */
  ownerId?: string
}

export function labelBox(x: number, y: number, text: string, fontPx: number, id: string, nudge: { x: number; y: number }, locked = false): ScreenLabel {
  const w = Math.max(fontPx, text.length * fontPx * 0.62)
  const h = fontPx * 1.2
  return { id, x, y, w, h, nudge, locked }
}

function pairGap(a: ScreenLabel, b: ScreenLabel): number {
  const ids = [a.id, b.id]
  const has = (prefix: string) => ids.some((id) => id.startsWith(prefix))
  if (has('beam-circle') && has('letter-')) return 14
  if (has('beam-circle') && has('miter-')) return 12
  if (has('miter-') && (has('angle-') || has('shelf-'))) return 10
  return 0
}

function overlaps(a: ScreenLabel, b: ScreenLabel): boolean {
  const gap = pairGap(a, b)
  const ax = a.x - a.w / 2
  const ay = a.y - a.h / 2
  const bx = b.x - b.w / 2
  const by = b.y - b.h / 2
  return ax < bx + b.w + gap - 0.5 && ax + a.w + gap > bx + 0.5 && ay < by + b.h + gap - 0.5 && ay + a.h + gap > by + 0.5
}

export function segmentsCross(
  a: { x1: number; y1: number; x2: number; y2: number },
  b: { x1: number; y1: number; x2: number; y2: number },
): boolean {
  const side = (x1: number, y1: number, x2: number, y2: number, x: number, y: number) =>
    (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1)
  const d1 = side(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1)
  const d2 = side(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2)
  const d3 = side(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1)
  const d4 = side(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

function boxHitsSegment(label: ScreenLabel, line: ScreenSegment): boolean {
  const left = label.x - label.w / 2
  const right = label.x + label.w / 2
  const top = label.y - label.h / 2
  const bottom = label.y + label.h / 2
  const dx = line.x2 - line.x1
  const dy = line.y2 - line.y1
  const len = Math.hypot(dx, dy)
  if (len < 1e-6) {
    return line.x1 >= left && line.x1 <= right && line.y1 >= top && line.y1 <= bottom
  }
  const steps = Math.max(2, Math.ceil(len / 4))
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = line.x1 + dx * t
    const y = line.y1 + dy * t
    if (x >= left && x <= right && y >= top && y <= bottom) return true
  }
  return false
}

export function labelConflicts(labels: readonly ScreenLabel[], lines: readonly ScreenSegment[]): string[] {
  const hits: string[] = []
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      if (overlaps(labels[i], labels[j])) hits.push(`${labels[i].id}|${labels[j].id}`)
    }
    for (const line of lines) {
      if (line.ownerId === labels[i].id) continue
      if (boxHitsSegment(labels[i], line)) hits.push(`${labels[i].id}|line`)
    }
  }
  return hits
}

function slideStep(label: ScreenLabel, other: { x: number; y: number }): number {
  const slide = label.slide ?? { x: 1, y: 0 }
  const along = (other.x - label.x) * slide.x + (other.y - label.y) * slide.y
  return along >= 0 ? -16 : 16
}

/** Push unlocked labels until they clear other text and dimension lines. Circles slide along the beam. */
export function separateLabels(labels: readonly ScreenLabel[], lines: readonly ScreenSegment[]): ScreenLabel[] {
  const out = labels.map((label) => ({
    ...label,
    nudge: { ...label.nudge },
    ...(label.slide ? { slide: { ...label.slide } } : {}),
  }))
  for (let pass = 0; pass < 36; pass++) {
    let moved = false
    for (const label of out) {
      if (label.locked) continue
      if (label.slide) {
        let shift = 0
        for (const other of out) {
          if (other.id === label.id || !overlaps(label, other)) continue
          shift += slideStep(label, other)
        }
        for (const line of lines) {
          if (line.ownerId === label.id || !boxHitsSegment(label, line)) continue
          const mid = { x: (line.x1 + line.x2) / 2, y: (line.y1 + line.y2) / 2 }
          shift += slideStep(label, mid)
        }
        if (shift === 0) continue
        const step = Math.sign(shift) * Math.min(Math.abs(shift), 16)
        label.x += label.slide.x * step
        label.y += label.slide.y * step
        moved = true
        continue
      }
      let ax = 0
      let ay = 0
      for (const other of out) {
        if (other.id === label.id || !overlaps(label, other)) continue
        const keepDimension = other.slide && !label.id.startsWith('angle') && !label.id.startsWith('miter')
        if (keepDimension) continue
        let dx = label.x - other.x
        let dy = label.y - other.y
        if (Math.hypot(dx, dy) < 0.1) {
          dx = label.nudge.x
          dy = label.nudge.y
        }
        const prefer = dx * label.nudge.x + dy * label.nudge.y
        if (prefer < 0) {
          dx = -label.nudge.y
          dy = label.nudge.x
        }
        const len = Math.hypot(dx, dy) || 1
        ax += (dx / len) * 12
        ay += (dy / len) * 12
      }
      for (const line of lines) {
        if (line.ownerId === label.id || !boxHitsSegment(label, line)) continue
        ax += label.nudge.x * 10
        ay += label.nudge.y * 10
      }
      if (label.leaderTo && !label.id.startsWith('angle-')) {
        const leader = { x1: label.leaderTo.x, y1: label.leaderTo.y, x2: label.x, y2: label.y }
        for (const other of out) {
          const isDimension = other.id.startsWith('dim') || other.id.startsWith('clear') || other.id.startsWith('shelf')
          if (!isDimension || !boxHitsSegment(other, leader)) continue
          ax += label.nudge.x * 14
          ay += label.nudge.y * 14
        }
      }
      if (ax === 0 && ay === 0) continue
      const alongOut = ax * label.nudge.x + ay * label.nudge.y
      if ((label.id.startsWith('dim') || label.id.startsWith('clear')) && alongOut < 0) {
        ax -= label.nudge.x * alongOut
        ay -= label.nudge.y * alongOut
        if (Math.hypot(ax, ay) < 0.5) {
          ax = label.nudge.x
          ay = label.nudge.y
        }
      }
      const len = Math.hypot(ax, ay) || 1
      const step = Math.min(len, 18)
      label.x += (ax / len) * step
      label.y += (ay / len) * step
      moved = true
    }
    if (!moved) break
  }
    const slid = out.map((label) => {
      if (!label.slide || !label.slideFrom || !label.slideTo || label.locked) return label
      const from = label.slideFrom
      const to = label.slideTo
      const len = Math.hypot(to.x - from.x, to.y - from.y)
      if (len < 40) return label
      const hits = (x: number, y: number) => {
        const trial = { ...label, x, y }
        for (const other of out) {
          if (other.id === label.id) continue
          if (overlaps(trial, other)) return true
        }
        for (const line of lines) {
          if (line.ownerId === label.id) continue
          if (boxHitsSegment(trial, line)) return true
        }
        return false
      }
      const margin = 48
      let bestX = label.x
      let bestY = label.y
      let bestDist = hits(label.x, label.y) ? Infinity : 0
      const steps = Math.max(8, Math.ceil(len / 14))
      for (let i = 0; i <= steps; i++) {
        const t = margin / len + (i / steps) * (1 - 2 * margin / len)
        const x = from.x + (to.x - from.x) * t
        const y = from.y + (to.y - from.y) * t
        if (hits(x, y)) continue
        const dist = Math.hypot(x - label.x, y - label.y)
        if (dist < bestDist) {
          bestDist = dist
          bestX = x
          bestY = y
        }
      }
      return { ...label, x: bestX, y: bestY }
    }).map((label) => {
      if (!label.id.startsWith('miter') || !label.origin) return label
      const dx = label.x - label.origin.x
      const dy = label.y - label.origin.y
      const dist = Math.hypot(dx, dy)
      if (dist <= 72) return label
      return { ...label, x: label.origin.x + (dx / dist) * 72, y: label.origin.y + (dy / dist) * 72 }
    })
    return slid.map((label) => {
      const pullsLeader = label.id.startsWith('miter') || label.id.startsWith('angle-')
      if (!pullsLeader || !label.leaderTo || (label.id.startsWith('miter') && !label.origin)) return label
      const hitsDimension = (x: number, y: number) => {
        const leader = { x1: label.leaderTo!.x, y1: label.leaderTo!.y, x2: x, y2: y }
        const box = { ...label, x, y }
        for (const other of slid) {
          if (other.id === label.id) continue
          if (overlaps(box, other)) return true
          const isDimension = other.id.startsWith('dim') || other.id.startsWith('clear') || other.id.startsWith('shelf')
          if (isDimension && boxHitsSegment(other, leader)) return true
        }
        for (const line of lines) {
          if (boxHitsSegment(box, line)) return true
          const owner = line.ownerId ?? ''
          if ((owner.startsWith('dim') || owner.startsWith('clear')) && segmentsCross(leader, line)) return true
        }
        return false
      }
      if (!hitsDimension(label.x, label.y)) return label
      const tip = label.leaderTo
      const vx = label.x - tip.x
      const vy = label.y - tip.y
      const vlen = Math.hypot(vx, vy) || 1
      const ux = vx / vlen
      const uy = vy / vlen
      const px = -uy
      const py = ux
      let best: { x: number; y: number; dist: number } | null = null
      const alongs = label.id.startsWith('angle-') ? [36, 52, 70, 90, 110, 150, 190, 240] : [36, 52, 70, 90, 110]
      const sides = label.id.startsWith('angle-') ? [0, 28, -28, 56, -56, 90, -90] : [0, 24, -24, 42, -42]
      for (const along of alongs) {
        for (const side of sides) {
          const x = tip.x + ux * along + px * side
          const y = tip.y + uy * along + py * side
          if (hitsDimension(x, y)) continue
          const dist = Math.hypot(x - tip.x, y - tip.y)
          if (!best || dist < best.dist) best = { x, y, dist }
        }
      }
      return best ? { ...label, x: best.x, y: best.y } : label
    })
  }
