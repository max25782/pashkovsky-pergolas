/**
 * Pergola Area Calculation Utilities
 * Calculates area for different pergola shapes: rectangle, L, X, U
 */

import { PergolaShape } from '@/types/offer'

/**
 * Calculate area for rectangle shape
 */
function calculateRectangleArea(shape: { width: number; length: number }): number {
  return shape.width * shape.length
}

/**
 * Calculate area for L-shape (Г-образная)
 * Formula: leg1_area + leg2_area - overlap_area
 */
function calculateLShapeArea(shape: {
  leg1: { width: number; length: number }
  leg2: { width: number; length: number }
  overlap?: { width: number; length: number }
}): number {
  const leg1Area = shape.leg1.width * shape.leg1.length
  const leg2Area = shape.leg2.width * shape.leg2.length
  
  // If overlap is specified, subtract it
  if (shape.overlap) {
    const overlapArea = shape.overlap.width * shape.overlap.length
    return leg1Area + leg2Area - overlapArea
  }
  
  // Otherwise, calculate overlap automatically
  // Overlap is the intersection of the two legs
  // Assuming legs meet at a corner, overlap = min(leg1.width, leg2.width) * min(leg1.length, leg2.length)
  // But this is simplified - actual overlap depends on how legs are positioned
  // For now, we'll use a conservative estimate: assume minimal overlap
  const estimatedOverlap = Math.min(shape.leg1.width, shape.leg2.width) * 
                          Math.min(shape.leg1.length, shape.leg2.length) * 0.5
  return leg1Area + leg2Area - estimatedOverlap
}

/**
 * Calculate area for X-shape (Х-образная / крестообразная)
 * Formula: center_area + sum(arms_area) - overlaps
 */
function calculateXShapeArea(shape: {
  center: { width: number; length: number }
  arms: Array<{
    direction: 'north' | 'south' | 'east' | 'west'
    width: number
    length: number
  }>
}): number {
  const centerArea = shape.center.width * shape.center.length
  
  // Sum all arm areas
  const armsArea = shape.arms.reduce((sum, arm) => {
    return sum + (arm.width * arm.length)
  }, 0)
  
  // Calculate overlaps between center and arms
  // Each arm overlaps with center by approximately center dimensions
  // But we need to subtract the overlaps to avoid double counting
  // Simplified: subtract center area * (number of arms / 4) to account for overlaps
  const overlapArea = centerArea * (shape.arms.length / 4)
  
  return centerArea + armsArea - overlapArea
}

/**
 * Calculate area for U-shape (П-образная)
 * Formula: base_area + leftLeg_area + rightLeg_area - overlaps
 */
function calculateUShapeArea(shape: {
  base: { width: number; length: number }
  leftLeg: { width: number; length: number }
  rightLeg: { width: number; length: number }
}): number {
  const baseArea = shape.base.width * shape.base.length
  const leftLegArea = shape.leftLeg.width * shape.leftLeg.length
  const rightLegArea = shape.rightLeg.width * shape.rightLeg.length
  
  // Calculate overlaps between base and legs
  // Left leg overlaps with base at left corner
  const leftOverlap = Math.min(shape.base.width, shape.leftLeg.width) * 
                      Math.min(shape.base.length, shape.leftLeg.length) * 0.5
  
  // Right leg overlaps with base at right corner
  const rightOverlap = Math.min(shape.base.width, shape.rightLeg.width) * 
                       Math.min(shape.base.length, shape.rightLeg.length) * 0.5
  
  return baseArea + leftLegArea + rightLegArea - leftOverlap - rightOverlap
}

/**
 * Main function to calculate pergola area based on shape type
 */
export function calculatePergolaArea(shape: PergolaShape): number {
  switch (shape.type) {
    case 'rectangle':
      return calculateRectangleArea(shape)
    
    case 'L':
      return calculateLShapeArea(shape)
    
    case 'X':
      return calculateXShapeArea(shape)
    
    case 'U':
      return calculateUShapeArea(shape)
    
    default:
      // TypeScript exhaustiveness check
      const _exhaustive: never = shape
      throw new Error(`Unknown shape type: ${(_exhaustive as any).type}`)
  }
}

/**
 * Helper to get shape dimensions summary (for display)
 */
export function getShapeDimensionsSummary(shape: PergolaShape): string {
  switch (shape.type) {
    case 'rectangle':
      return `${shape.width}м × ${shape.length}м`
    
    case 'L':
      return `Нога 1: ${shape.leg1.width}м × ${shape.leg1.length}м, Нога 2: ${shape.leg2.width}м × ${shape.leg2.length}м`
    
    case 'X':
      return `Центр: ${shape.center.width}м × ${shape.center.length}м, Рукавов: ${shape.arms.length}`
    
    case 'U':
      return `Основание: ${shape.base.width}м × ${shape.base.length}м, Ноги: ${shape.leftLeg.width}м × ${shape.leftLeg.length}м`
    
    default:
      return 'Неизвестная форма'
  }
}

/**
 * Validate shape data
 */
export function validatePergolaShape(shape: PergolaShape): { valid: boolean; error?: string } {
  switch (shape.type) {
    case 'rectangle':
      if (shape.width <= 0 || shape.length <= 0) {
        return { valid: false, error: 'Ширина и длина должны быть больше 0' }
      }
      return { valid: true }
    
    case 'L':
      if (shape.leg1.width <= 0 || shape.leg1.length <= 0 ||
          shape.leg2.width <= 0 || shape.leg2.length <= 0) {
        return { valid: false, error: 'Размеры обеих ног должны быть больше 0' }
      }
      if (shape.overlap && (shape.overlap.width < 0 || shape.overlap.length < 0)) {
        return { valid: false, error: 'Пересечение не может быть отрицательным' }
      }
      return { valid: true }
    
    case 'X':
      if (shape.center.width <= 0 || shape.center.length <= 0) {
        return { valid: false, error: 'Размеры центра должны быть больше 0' }
      }
      if (shape.arms.length === 0) {
        return { valid: false, error: 'Должен быть хотя бы один рукав' }
      }
      for (const arm of shape.arms) {
        if (arm.width <= 0 || arm.length <= 0) {
          return { valid: false, error: 'Размеры всех рукавов должны быть больше 0' }
        }
      }
      return { valid: true }
    
    case 'U':
      if (shape.base.width <= 0 || shape.base.length <= 0 ||
          shape.leftLeg.width <= 0 || shape.leftLeg.length <= 0 ||
          shape.rightLeg.width <= 0 || shape.rightLeg.length <= 0) {
        return { valid: false, error: 'Все размеры должны быть больше 0' }
      }
      return { valid: true }
    
    default:
      return { valid: false, error: 'Неизвестный тип формы' }
  }
}



