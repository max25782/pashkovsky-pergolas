/**
 * Suntuf/SantaF Sheet Calculation
 * 
 * BUSINESS CONTEXT:
 * Suntuf sheets are sold by PHYSICAL COUNT, not by pergola area.
 * Due to mandatory overlaps between sheets, the material area used
 * is always greater than the pergola area covered.
 * 
 * PROFILE: 76/18 corrugated polycarbonate sheets
 */

export type OverlapType = 'single' | 'double'

/**
 * Physical sheet dimensions (Profile 76/18)
 */
export const TOTAL_SHEET_WIDTH = 1.045 // meters - full physical width of sheet
export const EFFECTIVE_WIDTH_SINGLE = 0.988 // meters - coverage with 1-wave overlap
export const EFFECTIVE_WIDTH_DOUBLE = 0.969 // meters - coverage with 2-wave overlap (manufacturer recommended)

/**
 * Result of Suntuf calculation
 */
export interface SuntufCalculationResult {
  /** Exact number of sheets required (always rounded UP) */
  sheetsCount: number
  /** Material area to charge customer (based on full sheet dimensions) */
  suntufMaterialArea: number // m²
  /** Actual pergola area covered */
  pergolaArea: number // m²
  /** Overlap type used in calculation */
  overlapType: OverlapType
  /** Effective width per sheet (after overlap) */
  effectiveSheetWidth: number // m
  /** Total sheet width (physical) */
  totalSheetWidth: number // m
}

/**
 * Calculate Suntuf sheets required for a pergola
 * 
 * @param pergolaWidth - Horizontal width that sheets must cover (meters)
 * @param pergolaLength - Length of each sheet along the slope (meters)
 * @param overlapType - 'single' for 1-wave overlap, 'double' for 2-wave overlap (recommended)
 * @returns Calculation result with sheet count and areas
 * 
 * @example
 * // Example: 2m x 2m pergola with double overlap
 * const result = calculateSuntufSheets(2, 2, 'double')
 * // Result: {
 * //   sheetsCount: 3,
 * //   suntufMaterialArea: 6.27, // 3 sheets × 2m × 1.045m
 * //   pergolaArea: 4.0, // 2m × 2m
 * //   overlapType: 'double',
 * //   effectiveSheetWidth: 0.969,
 * //   totalSheetWidth: 1.045
 * // }
 */
export function calculateSuntufSheets(
  pergolaWidth: number,
  pergolaLength: number,
  overlapType: OverlapType = 'double'
): SuntufCalculationResult {
  // Validate inputs
  if (pergolaWidth <= 0 || pergolaLength <= 0) {
    throw new Error('Pergola dimensions must be greater than zero')
  }

  // Determine effective width based on overlap type
  // Effective width is LESS than total width due to mandatory overlaps
  // This is why material area > pergola area
  const effectiveSheetWidth = overlapType === 'double' 
    ? EFFECTIVE_WIDTH_DOUBLE 
    : EFFECTIVE_WIDTH_SINGLE

  // Calculate number of sheets needed
  // CRITICAL: Always round UP (Math.ceil)
  // Even if we need 2.1 sheets, we must order 3 full sheets
  // Partial coverage still requires a full additional sheet
  const sheetsCount = Math.ceil(pergolaWidth / effectiveSheetWidth)

  // Calculate pergola area (actual coverage)
  const pergolaArea = pergolaWidth * pergolaLength

  // Calculate material area for billing
  // IMPORTANT: Use TOTAL_SHEET_WIDTH, not effective width
  // Billing must reflect actual material consumed (full sheets)
  // This ensures transparency and legal compliance
  const suntufMaterialArea = sheetsCount * pergolaLength * TOTAL_SHEET_WIDTH

  return {
    sheetsCount,
    suntufMaterialArea: Number(suntufMaterialArea.toFixed(2)),
    pergolaArea: Number(pergolaArea.toFixed(2)),
    overlapType,
    effectiveSheetWidth,
    totalSheetWidth: TOTAL_SHEET_WIDTH,
  }
}

/**
 * Calculate price for Suntuf based on sheet count and price per sheet
 * 
 * @param sheetsCount - Number of sheets required
 * @param pricePerSheet - Price per sheet in ILS
 * @returns Total price for Suntuf sheets
 */
export function calculateSuntufPrice(
  sheetsCount: number,
  pricePerSheet: number
): number {
  return sheetsCount * pricePerSheet
}

/**
 * Calculate price for Suntuf based on material area and price per m²
 * 
 * NOTE: This method uses material area (full sheet dimensions)
 * which is the correct way to price Suntuf for billing transparency
 * 
 * @param suntufMaterialArea - Material area in m² (from calculateSuntufSheets)
 * @param pricePerSqm - Price per square meter in ILS
 * @returns Total price for Suntuf material
 */
export function calculateSuntufPriceByArea(
  suntufMaterialArea: number,
  pricePerSqm: number
): number {
  return suntufMaterialArea * pricePerSqm
}

/**
 * EXAMPLE USAGE:
 * 
 * // Example: 2m x 2m pergola with double overlap
 * const result = calculateSuntufSheets(2, 2, 'double')
 * 
 * // Result:
 * // {
 * //   sheetsCount: 3,
 * //   suntufMaterialArea: 6.27,  // 3 sheets × 2m × 1.045m = 6.27 m²
 * //   pergolaArea: 4.0,          // 2m × 2m = 4.0 m²
 * //   overlapType: 'double',
 * //   effectiveSheetWidth: 0.969,
 * //   totalSheetWidth: 1.045
 * // }
 * 
 * // Explanation:
 * // - pergolaWidth = 2m
 * // - effectiveSheetWidth (double) = 0.969m
 * // - sheetsCount = ceil(2 / 0.969) = ceil(2.064) = 3 sheets
 * // - Material area = 3 × 2m × 1.045m = 6.27 m² (billing)
 * // - Pergola area = 2m × 2m = 4.0 m² (coverage)
 * // - Difference: 6.27 - 4.0 = 2.27 m² (overlap waste)
 * 
 * // Pricing:
 * // If price per m² = 220 ILS:
 * // Total price = 6.27 × 220 = 1,379.40 ILS
 * // NOT 4.0 × 220 = 880 ILS (incorrect!)
 */
