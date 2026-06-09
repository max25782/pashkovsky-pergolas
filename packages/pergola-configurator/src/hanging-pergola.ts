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

export function clampHangerCount(n: number): number {
  if (!Number.isFinite(n)) return 2
  return Math.min(8, Math.max(1, Math.round(n)))
}

/** X positions (cm from left edge of section) for evenly spaced hangers. */
export function hangerPositionsCm(widthCm: number, count: number): number[] {
  const w = Math.max(0, Number(widthCm) || 0)
  const c = clampHangerCount(count)
  if (w <= 0 || c <= 0) return []
  const spacing = w / (c + 1)
  return Array.from({ length: c }, (_, i) => Math.round(spacing * (i + 1) * 10) / 10)
}
