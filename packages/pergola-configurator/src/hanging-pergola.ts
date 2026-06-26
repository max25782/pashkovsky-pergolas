/** Wall mount rise (cm) for hanging pergola — 1:3 ratio vs projection depth (עומק). */
export function hangerWallRiseCm(depthCm: number): number {
  const d = Math.max(0, Number(depthCm) || 0)
  return Math.round((d / 3) * 10) / 10
}

/** Diagonal hanger pipe length (cm) from front beam to wall mount point. */
export function hangerPipeLengthCm(depthCm: number): number {
  const d = Math.max(0, Number(depthCm) || 0)
  const rise = d / 3
  return Math.round(Math.sqrt(d * d + rise * rise) * 10) / 10
}

/**
 * Middle-only hangers added by the user (total always includes the 2 fixed edge ones).
 * We store "extra middle count" = hangerCount - 2, clamped to 0–6.
 */
export function clampHangerCount(n: number): number {
  if (!Number.isFinite(n)) return 0
  // n = extra middle hangers (0 = only left+right edges)
  return Math.min(6, Math.max(0, Math.round(n)))
}

/**
 * X positions (cm from left edge of section):
 *   - Always: left edge hanger (offset = edgeOffset) and right edge hanger.
 *   - Plus: `count` additional hangers distributed evenly in the middle.
 *
 * edgeOffset defaults to postSizeCm/2 so brackets sit on the beam corner.
 */
export function hangerPositionsCm(
  widthCm: number,
  middleCount: number,
  edgeOffsetCm = 5,
): number[] {
  const w = Math.max(0, Number(widthCm) || 0)
  if (w <= 0) return []

  const leftPos = Math.round(edgeOffsetCm * 10) / 10
  const rightPos = Math.round((w - edgeOffsetCm) * 10) / 10

  const mc = Math.min(6, Math.max(0, Math.round(middleCount)))
  const positions: number[] = [leftPos]

  if (mc > 0) {
    const span = rightPos - leftPos
    const spacing = span / (mc + 1)
    for (let i = 1; i <= mc; i++) {
      positions.push(Math.round((leftPos + spacing * i) * 10) / 10)
    }
  }

  positions.push(rightPos)
  return positions
}
