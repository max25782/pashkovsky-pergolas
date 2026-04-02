/**
 * Stock bar lengths available per profile category (in cm).
 * Posts come only in 6 m bars.
 * Frame/intermediate beams come in 6, 6.5, or 7 m bars.
 * Lamellas come only in 6 m bars.
 */
export const STOCK_LENGTHS_CM = {
  post: [600] as number[],
  beam: [600, 650, 700] as number[],
  lamella: [600] as number[],
} as const

export type ProfileCategory = keyof typeof STOCK_LENGTHS_CM

/**
 * Returns the shortest stock bar length (cm) that is >= cutLengthCm.
 * Returns null if no stock length is long enough.
 */
export function chooseStockLength(
  category: ProfileCategory,
  cutLengthCm: number,
): number | null {
  const options = STOCK_LENGTHS_CM[category] as readonly number[]
  const sorted = [...options].sort((a, b) => a - b)
  return sorted.find((l) => l >= cutLengthCm) ?? null
}
