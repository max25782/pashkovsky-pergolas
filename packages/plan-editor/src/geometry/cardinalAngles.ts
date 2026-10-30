const CARDINAL_DEG = [0, 90, 180, 270]

export function normalizeAngleDeg(deg: number): number {
  return ((deg % 360) + 360) % 360
}

export function isCardinalAngleDeg(deg: number, toleranceDeg = 0.5): boolean {
  const a = normalizeAngleDeg(deg)
  return CARDINAL_DEG.some((t) => Math.abs(a - t) <= toleranceDeg)
}

export function allEdgesCardinalAngles(angleDeg: number[], toleranceDeg = 0.5): boolean {
  return angleDeg.every((a) => isCardinalAngleDeg(a, toleranceDeg))
}
