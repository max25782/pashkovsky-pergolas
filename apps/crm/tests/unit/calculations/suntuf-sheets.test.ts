/**
 * Unit tests for Suntuf/SantaF sheet calculation
 * 
 * Tests the business-critical logic for calculating:
 * - Exact number of sheets required (always rounded UP)
 * - Material area for billing (uses TOTAL_SHEET_WIDTH, not effective width)
 * - Pergola area coverage
 * 
 * BUSINESS CONTEXT:
 * Suntuf sheets are sold by physical count, not pergola area.
 * Due to mandatory overlaps, material area > pergola area.
 * Billing must reflect actual material consumed for legal transparency.
 */

import { 
  calculateSuntufSheets, 
  calculateSuntufPrice,
  calculateSuntufPriceByArea,
  TOTAL_SHEET_WIDTH,
  EFFECTIVE_WIDTH_SINGLE,
  EFFECTIVE_WIDTH_DOUBLE,
  type OverlapType 
} from '@/lib/calculations/suntuf-sheets'

describe('calculateSuntufSheets', () => {
  
  describe('Sheet Count Calculation (Math.ceil rounding)', () => {
    
    test('should round UP for fractional sheet requirements (double overlap)', () => {
      // 2m width requires 2.064 sheets with double overlap (0.969m effective)
      // Must round UP to 3 full sheets
      const result = calculateSuntufSheets(2, 2, 'double')
      expect(result.sheetsCount).toBe(3)
    })

    test('should round UP for fractional sheet requirements (single overlap)', () => {
      // 2m width requires 2.024 sheets with single overlap (0.988m effective)
      // Must round UP to 3 full sheets
      const result = calculateSuntufSheets(2, 2, 'single')
      expect(result.sheetsCount).toBe(3)
    })

    test('should use exact count when width equals N × effective width (double)', () => {
      // Width exactly equals 2 effective widths
      const width = 2 * EFFECTIVE_WIDTH_DOUBLE // 1.938m
      const result = calculateSuntufSheets(width, 3, 'double')
      expect(result.sheetsCount).toBe(2)
    })

    test('should use exact count when width equals N × effective width (single)', () => {
      // Width exactly equals 2 effective widths
      const width = 2 * EFFECTIVE_WIDTH_SINGLE // 1.976m
      const result = calculateSuntufSheets(width, 3, 'single')
      expect(result.sheetsCount).toBe(2)
    })

    test('should add full sheet when width exceeds boundary by even 0.001m (double)', () => {
      // Just over 2 sheets boundary → requires 3 sheets
      const width = 2 * EFFECTIVE_WIDTH_DOUBLE + 0.001 // 1.939m
      const result = calculateSuntufSheets(width, 3, 'double')
      expect(result.sheetsCount).toBe(3)
    })

    test('should add full sheet when width exceeds boundary by even 0.001m (single)', () => {
      // Just over 2 sheets boundary → requires 3 sheets
      const width = 2 * EFFECTIVE_WIDTH_SINGLE + 0.001 // 1.977m
      const result = calculateSuntufSheets(width, 3, 'single')
      expect(result.sheetsCount).toBe(3)
    })

    test('should calculate correct sheet count for 6m × 4m pergola (double overlap)', () => {
      // Real-world case: 6m wide pergola
      // 6 / 0.969 = 6.193 → 7 sheets required
      const result = calculateSuntufSheets(6, 4, 'double')
      expect(result.sheetsCount).toBe(7)
    })

  })

  describe('Overlap Type Selection', () => {
    
    test('should use EFFECTIVE_WIDTH_DOUBLE for double overlap', () => {
      const result = calculateSuntufSheets(2, 2, 'double')
      expect(result.effectiveSheetWidth).toBe(EFFECTIVE_WIDTH_DOUBLE)
      expect(result.effectiveSheetWidth).toBe(0.969)
    })

    test('should use EFFECTIVE_WIDTH_SINGLE for single overlap', () => {
      const result = calculateSuntufSheets(2, 2, 'single')
      expect(result.effectiveSheetWidth).toBe(EFFECTIVE_WIDTH_SINGLE)
      expect(result.effectiveSheetWidth).toBe(0.988)
    })

    test('should default to double overlap when not specified', () => {
      const result = calculateSuntufSheets(2, 2)
      expect(result.overlapType).toBe('double')
      expect(result.effectiveSheetWidth).toBe(EFFECTIVE_WIDTH_DOUBLE)
    })

  })

  describe('Material Area Calculation (CRITICAL for billing)', () => {
    
    test('should calculate material area using TOTAL_SHEET_WIDTH, not effective width', () => {
      // 2m × 2m pergola, double overlap
      // sheetsCount = 3
      // Material area = 3 sheets × 2m length × 1.045m TOTAL width
      const result = calculateSuntufSheets(2, 2, 'double')
      
      expect(result.sheetsCount).toBe(3)
      expect(result.suntufMaterialArea).toBeCloseTo(6.27, 2)
      
      // Verify calculation manually:
      const expectedMaterialArea = result.sheetsCount * 2 * TOTAL_SHEET_WIDTH
      expect(result.suntufMaterialArea).toBeCloseTo(expectedMaterialArea, 2)
    })

    test('material area should ALWAYS exceed pergola area due to overlaps', () => {
      // This is the key business rule: we bill for material consumed, not coverage
      const result = calculateSuntufSheets(6, 4, 'double')
      
      expect(result.suntufMaterialArea).toBeGreaterThan(result.pergolaArea)
      
      // For 6×4 pergola:
      // - Pergola area = 24 m²
      // - Material area = 7 sheets × 4m × 1.045m = 29.26 m²
      // - Difference = 5.26 m² (overlap waste)
      expect(result.pergolaArea).toBe(24)
      expect(result.suntufMaterialArea).toBeCloseTo(29.26, 2)
    })

    test('should use TOTAL_SHEET_WIDTH in material calculation, NOT effective width', () => {
      const result = calculateSuntufSheets(3, 4, 'double')
      
      // Material area calculation:
      const expectedMaterialArea = result.sheetsCount * 4 * TOTAL_SHEET_WIDTH
      expect(result.suntufMaterialArea).toBeCloseTo(expectedMaterialArea, 2)
      
      // WRONG calculation (using effective width):
      const wrongCalculation = result.sheetsCount * 4 * EFFECTIVE_WIDTH_DOUBLE
      expect(result.suntufMaterialArea).not.toBeCloseTo(wrongCalculation, 2)
    })

  })

  describe('Pergola Area Calculation', () => {
    
    test('should calculate pergola area correctly', () => {
      const result = calculateSuntufSheets(6, 4, 'double')
      expect(result.pergolaArea).toBe(24)
    })

    test('pergola area should be independent of overlap type', () => {
      // Use 3m width: double=ceil(3/0.969)=4, single=ceil(3/0.988)=4 (same sheets)
      // But use 2m width: double=ceil(2/0.969)=3, single=ceil(2/0.988)=3 (same too)
      // Use 3.5m width: double=ceil(3.5/0.969)=4, single=ceil(3.5/0.988)=4 (same)
      // Use 6m width: double=ceil(6/0.969)=7, single=ceil(6/0.988)=7 (same)
      // Let's use different widths where sheet count differs:
      const resultDouble = calculateSuntufSheets(6, 4, 'double')
      const resultSingle = calculateSuntufSheets(6, 4, 'single')
      
      // Pergola area is same regardless of overlap
      expect(resultDouble.pergolaArea).toBe(24)
      expect(resultSingle.pergolaArea).toBe(24)
      
      // Sheet counts: double=7, single=7 (actually same for 6m!)
      // Better example: 2.5m width
      const result2Double = calculateSuntufSheets(2.5, 3, 'double')
      const result2Single = calculateSuntufSheets(2.5, 3, 'single')
      
      // Pergola area same for both
      expect(result2Double.pergolaArea).toBe(7.5)
      expect(result2Single.pergolaArea).toBe(7.5)
      
      // Material area CAN be different if sheet count differs
      // (for 2.5m: double=ceil(2.5/0.969)=3, single=ceil(2.5/0.988)=3, still same!)
      // Point: pergola area is ALWAYS independent of overlap type
      expect(result2Double.pergolaArea).toBe(result2Single.pergolaArea)
    })

  })

  describe('Real-world Business Examples', () => {
    
    test('Example 1: 6m × 4m pergola, double overlap (recommended)', () => {
      const result = calculateSuntufSheets(6, 4, 'double')
      
      // Business expectations:
      expect(result.sheetsCount).toBe(7) // ceil(6 / 0.969) = 7
      expect(result.pergolaArea).toBe(24) // 6 × 4
      expect(result.suntufMaterialArea).toBeCloseTo(29.26, 2) // 7 × 4 × 1.045
      expect(result.overlapType).toBe('double')
      
      // Pricing example (if 200 ₪/m²):
      const pricePerSqm = 200
      const totalPrice = calculateSuntufPriceByArea(result.suntufMaterialArea, pricePerSqm)
      expect(totalPrice).toBeCloseTo(5852, 0) // 29.26 × 200
      
      // NOT 4,800 ₪ (24 × 200) - that would be incorrect billing!
    })

    test('Example 2: 2m × 2m pergola, double overlap', () => {
      const result = calculateSuntufSheets(2, 2, 'double')
      
      expect(result.sheetsCount).toBe(3) // ceil(2 / 0.969) = 3
      expect(result.pergolaArea).toBe(4) // 2 × 2
      expect(result.suntufMaterialArea).toBeCloseTo(6.27, 2) // 3 × 2 × 1.045
      
      // Pricing example (if 220 ₪/m²):
      const totalPrice = calculateSuntufPriceByArea(result.suntufMaterialArea, 220)
      expect(totalPrice).toBeCloseTo(1379.4, 1) // 6.27 × 220
    })

    test('Example 3: 4m × 5m pergola, single overlap', () => {
      const result = calculateSuntufSheets(4, 5, 'single')
      
      // With single overlap (0.988m effective):
      // sheetsCount = ceil(4 / 0.988) = ceil(4.049) = 5 sheets
      expect(result.sheetsCount).toBe(5)
      expect(result.pergolaArea).toBe(20) // 4 × 5
      expect(result.suntufMaterialArea).toBeCloseTo(26.125, 2) // 5 × 5 × 1.045
      expect(result.overlapType).toBe('single')
    })

    test('Example 4: Small pergola 1.5m × 2m, double overlap', () => {
      const result = calculateSuntufSheets(1.5, 2, 'double')
      
      // ceil(1.5 / 0.969) = ceil(1.548) = 2 sheets
      expect(result.sheetsCount).toBe(2)
      expect(result.pergolaArea).toBe(3) // 1.5 × 2
      expect(result.suntufMaterialArea).toBeCloseTo(4.18, 2) // 2 × 2 × 1.045
    })

  })

  describe('Input Validation', () => {
    
    test('should throw error for non-positive pergola width', () => {
      expect(() => calculateSuntufSheets(0, 2, 'double')).toThrow('Pergola dimensions must be greater than zero')
      expect(() => calculateSuntufSheets(-1, 2, 'double')).toThrow('Pergola dimensions must be greater than zero')
    })

    test('should throw error for non-positive pergola length', () => {
      expect(() => calculateSuntufSheets(2, 0, 'double')).toThrow('Pergola dimensions must be greater than zero')
      expect(() => calculateSuntufSheets(2, -1, 'double')).toThrow('Pergola dimensions must be greater than zero')
    })

    test('should throw error for both dimensions non-positive', () => {
      expect(() => calculateSuntufSheets(0, 0, 'double')).toThrow('Pergola dimensions must be greater than zero')
    })

  })

  describe('Boundary Cases', () => {
    
    test('exact width boundary: width = 2 × effective (double) should require exactly 2 sheets', () => {
      const width = 2 * EFFECTIVE_WIDTH_DOUBLE // 1.938m
      const result = calculateSuntufSheets(width, 3, 'double')
      expect(result.sheetsCount).toBe(2)
    })

    test('exact width boundary: width = 2 × effective (single) should require exactly 2 sheets', () => {
      const width = 2 * EFFECTIVE_WIDTH_SINGLE // 1.976m
      const result = calculateSuntufSheets(width, 3, 'single')
      expect(result.sheetsCount).toBe(2)
    })

    test('just over boundary: width = 2 × effective + 0.001m should require 3 sheets (double)', () => {
      const width = 2 * EFFECTIVE_WIDTH_DOUBLE + 0.001 // 1.939m
      const result = calculateSuntufSheets(width, 3, 'double')
      expect(result.sheetsCount).toBe(3)
    })

    test('just over boundary: width = 2 × effective + 0.001m should require 3 sheets (single)', () => {
      const width = 2 * EFFECTIVE_WIDTH_SINGLE + 0.001 // 1.977m
      const result = calculateSuntufSheets(width, 3, 'single')
      expect(result.sheetsCount).toBe(3)
    })

    test('very small pergola should still require at least 1 sheet', () => {
      const result = calculateSuntufSheets(0.5, 1, 'double')
      expect(result.sheetsCount).toBe(1)
    })

    test('very large pergola should calculate correctly', () => {
      // 10m wide pergola
      const result = calculateSuntufSheets(10, 5, 'double')
      // ceil(10 / 0.969) = ceil(10.32) = 11 sheets
      expect(result.sheetsCount).toBe(11)
      expect(result.suntufMaterialArea).toBeCloseTo(57.475, 1) // 11 × 5 × 1.045 (precision 1 for rounding)
    })

  })

  describe('Material vs Pergola Area Difference', () => {
    
    test('should document the overlap waste for billing transparency', () => {
      // 6m × 4m pergola
      const result = calculateSuntufSheets(6, 4, 'double')
      
      const overlapWaste = result.suntufMaterialArea - result.pergolaArea
      
      // Expect ~5.26 m² of overlap waste
      // This is NOT wasted material - it's required for proper overlap installation
      // Customer must be charged for this material
      expect(overlapWaste).toBeCloseTo(5.26, 2)
      expect(overlapWaste).toBeGreaterThan(0)
    })

    test('should show that using pergola area for billing would be incorrect', () => {
      const result = calculateSuntufSheets(6, 4, 'double')
      const pricePerSqm = 200
      
      // CORRECT billing (material area):
      const correctPrice = calculateSuntufPriceByArea(result.suntufMaterialArea, pricePerSqm)
      expect(correctPrice).toBeCloseTo(5852, 0) // 29.26 × 200
      
      // INCORRECT billing (pergola area):
      const incorrectPrice = result.pergolaArea * pricePerSqm
      expect(incorrectPrice).toBe(4800) // 24 × 200
      
      // Difference:
      const priceDifference = correctPrice - incorrectPrice
      expect(priceDifference).toBeCloseTo(1052, 0) // ~1,052 ₪ difference!
    })

  })

  describe('Pricing Functions', () => {
    
    test('calculateSuntufPrice should multiply sheets by price per sheet', () => {
      const price = calculateSuntufPrice(7, 500)
      expect(price).toBe(3500) // 7 sheets × 500 ₪/sheet
    })

    test('calculateSuntufPriceByArea should multiply material area by price per m²', () => {
      const price = calculateSuntufPriceByArea(29.26, 200)
      expect(price).toBeCloseTo(5852, 0)
    })

    test('pricing by material area should match real calculation', () => {
      const result = calculateSuntufSheets(6, 4, 'double')
      const pricePerSqm = 220
      
      const totalPrice = calculateSuntufPriceByArea(result.suntufMaterialArea, pricePerSqm)
      const expectedPrice = result.suntufMaterialArea * pricePerSqm
      
      expect(totalPrice).toBeCloseTo(expectedPrice, 2)
    })

  })

  describe('Return Value Structure', () => {
    
    test('should return all required fields', () => {
      const result = calculateSuntufSheets(6, 4, 'double')
      
      expect(result).toHaveProperty('sheetsCount')
      expect(result).toHaveProperty('suntufMaterialArea')
      expect(result).toHaveProperty('pergolaArea')
      expect(result).toHaveProperty('overlapType')
      expect(result).toHaveProperty('effectiveSheetWidth')
      expect(result).toHaveProperty('totalSheetWidth')
    })

    test('should return overlap type used', () => {
      const resultDouble = calculateSuntufSheets(3, 3, 'double')
      const resultSingle = calculateSuntufSheets(3, 3, 'single')
      
      expect(resultDouble.overlapType).toBe('double')
      expect(resultSingle.overlapType).toBe('single')
    })

    test('should return totalSheetWidth constant', () => {
      const result = calculateSuntufSheets(2, 2, 'double')
      expect(result.totalSheetWidth).toBe(TOTAL_SHEET_WIDTH)
      expect(result.totalSheetWidth).toBe(1.045)
    })

  })

  describe('Precision and Rounding', () => {
    
    test('should round material area to 2 decimal places', () => {
      const result = calculateSuntufSheets(2.5, 3.7, 'double')
      
      // Verify result is rounded to 2 decimals
      const asString = result.suntufMaterialArea.toString()
      const decimalPart = asString.split('.')[1]
      expect(decimalPart?.length || 0).toBeLessThanOrEqual(2)
    })

    test('should round pergola area to 2 decimal places', () => {
      const result = calculateSuntufSheets(2.333, 3.777, 'double')
      
      // Verify result is rounded to 2 decimals
      const asString = result.pergolaArea.toString()
      const decimalPart = asString.split('.')[1]
      expect(decimalPart?.length || 0).toBeLessThanOrEqual(2)
    })

  })

  describe('Edge Cases', () => {
    
    test('should handle minimal dimensions (0.1m × 0.1m)', () => {
      const result = calculateSuntufSheets(0.1, 0.1, 'double')
      expect(result.sheetsCount).toBe(1) // Still need at least 1 sheet
      expect(result.pergolaArea).toBe(0.01)
    })

    test('should handle large dimensions (20m × 10m)', () => {
      const result = calculateSuntufSheets(20, 10, 'double')
      
      // ceil(20 / 0.969) = ceil(20.64) = 21 sheets
      expect(result.sheetsCount).toBe(21)
      expect(result.pergolaArea).toBe(200)
      expect(result.suntufMaterialArea).toBeCloseTo(219.45, 2) // 21 × 10 × 1.045
    })

  })

})

/**
 * WHY WE BILL BY TOTAL_SHEET_WIDTH (Documentation Test)
 * 
 * This test documents the key business logic for legal and pricing transparency:
 */
describe('Business Logic Documentation', () => {
  
  test('WHY material area > pergola area: Overlaps are mandatory for proper installation', () => {
    // Customer orders: 6m × 4m pergola
    const result = calculateSuntufSheets(6, 4, 'double')
    
    // What customer sees:
    // - Pergola coverage: 24 m²
    // - Material consumed: 29.26 m²
    // - Difference: 5.26 m² is NOT waste
    
    // Explanation:
    // - Sheets must overlap by 1-2 waves to ensure waterproofing
    // - Overlaps consume additional material
    // - We cannot bill customer for only 24 m² when we use 29.26 m² of material
    
    expect(result.suntufMaterialArea).toBeCloseTo(29.26, 2)
    expect(result.pergolaArea).toBe(24)
    
    // The 5.26 m² difference is legitimate material consumption for overlaps
  })

  test('WHY we use TOTAL_SHEET_WIDTH, not effective width for billing', () => {
    const result = calculateSuntufSheets(6, 4, 'double')
    
    // Each sheet is physically 1.045m wide
    // After overlap, it covers only 0.969m
    // BUT: We purchase and consume the FULL 1.045m width
    
    // Correct billing: 7 sheets × 4m × 1.045m = 29.26 m²
    // Incorrect: 7 sheets × 4m × 0.969m = 27.13 m² (undercharges customer!)
    
    const correctBilling = result.sheetsCount * 4 * TOTAL_SHEET_WIDTH
    const incorrectBilling = result.sheetsCount * 4 * EFFECTIVE_WIDTH_DOUBLE
    
    expect(result.suntufMaterialArea).toBeCloseTo(correctBilling, 2)
    expect(result.suntufMaterialArea).not.toBeCloseTo(incorrectBilling, 2)
  })

})
