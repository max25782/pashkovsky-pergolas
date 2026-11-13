/**
 * The one way money is rounded to agorot in deal finance, worker cost, pension
 * and the Tazrim rows built from them.
 *
 * Half away from zero. The small epsilon keeps binary floating point from
 * rounding 1.005 down to 1.00 (1.005 * 100 is 100.49999999999999).
 */
const AGOROT_EPSILON = 1e-9

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0
  const sign = value < 0 ? -1 : 1
  return (sign * Math.round(Math.abs(value) * 100 + AGOROT_EPSILON)) / 100
}

/** Parses a DB numeric (number, numeric string, null) into a finite number, else 0. */
export function toAmount(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0
  const n = typeof value === 'number' ? value : parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

/**
 * Splits `total` across `weights` so the parts, each in whole agorot, add up
 * to exactly `roundMoney(total)` (largest remainder). Weights of zero get zero.
 * No positive weight: every part is zero.
 */
export function splitByWeights(total: number, weights: readonly number[]): number[] {
  const weightSum = weights.reduce((sum, w) => sum + (w > 0 ? w : 0), 0)
  if (weightSum <= 0) return weights.map(() => 0)

  const totalAgorot = Math.round(roundMoney(total) * 100)
  const exact = weights.map((w) => (w > 0 ? (totalAgorot * w) / weightSum : 0))
  const floors = exact.map((x) => Math.trunc(x))
  let remaining = totalAgorot - floors.reduce((sum, x) => sum + x, 0)

  // Hand the leftover agorot to the largest fractional parts (stable by index).
  const order = exact
    .map((x, index) => ({ index, fraction: Math.abs(x - Math.trunc(x)) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)

  const step = remaining >= 0 ? 1 : -1
  for (let i = 0; remaining !== 0 && order.length > 0; i = (i + 1) % order.length) {
    const target = order[i]
    if (weights[target.index] <= 0) continue
    floors[target.index] += step
    remaining -= step
  }

  return floors.map((agorot) => agorot / 100)
}
