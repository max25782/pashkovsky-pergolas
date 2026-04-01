import type {
  PergolaShape,
  RectangleShape,
  LShape,
  XShape,
  UShape,
} from './offer-calc-types'

export interface ShapeValidationResult {
  valid: boolean
  errors: string[]
}

export function validatePergolaShape(shape: PergolaShape): ShapeValidationResult {
  const errors: string[] = []

  switch (shape.type) {
    case 'rectangle': {
      const rect = shape as RectangleShape
      if (!rect.width || rect.width <= 0) errors.push('width')
      if (!rect.length || rect.length <= 0) errors.push('length')
      break
    }
    case 'L': {
      const lShape = shape as LShape
      if (!lShape.leg1?.width || lShape.leg1.width <= 0) errors.push('leg1w')
      if (!lShape.leg1?.length || lShape.leg1.length <= 0) errors.push('leg1l')
      if (!lShape.leg2?.width || lShape.leg2.width <= 0) errors.push('leg2w')
      if (!lShape.leg2?.length || lShape.leg2.length <= 0) errors.push('leg2l')
      break
    }
    case 'X': {
      const xShape = shape as XShape
      if (!xShape.center?.width || xShape.center.width <= 0) errors.push('cx')
      if (!xShape.center?.length || xShape.center.length <= 0) errors.push('cl')
      if (!xShape.arms || xShape.arms.length === 0) errors.push('arms')
      else {
        xShape.arms.forEach((arm, index) => {
          if (!arm.width || arm.width <= 0) errors.push(`a${index}w`)
          if (!arm.length || arm.length <= 0) errors.push(`a${index}l`)
        })
      }
      break
    }
    case 'U': {
      const uShape = shape as UShape
      if (!uShape.base?.width || uShape.base.width <= 0) errors.push('bw')
      if (!uShape.base?.length || uShape.base.length <= 0) errors.push('bl')
      if (!uShape.leftLeg?.width || uShape.leftLeg.width <= 0) errors.push('llw')
      if (!uShape.leftLeg?.length || uShape.leftLeg.length <= 0) errors.push('lll')
      if (!uShape.rightLeg?.width || uShape.rightLeg.width <= 0) errors.push('rlw')
      if (!uShape.rightLeg?.length || uShape.rightLeg.length <= 0) errors.push('rll')
      break
    }
    default:
      errors.push('unknown')
  }

  return { valid: errors.length === 0, errors }
}

function calculateRectangleArea(shape: RectangleShape): number {
  return shape.width * shape.length
}

function calculateLShapeArea(shape: LShape): number {
  const leg1Area = shape.leg1.width * shape.leg1.length
  const leg2Area = shape.leg2.width * shape.leg2.length
  let overlapArea = 0
  if (shape.overlap) overlapArea = shape.overlap.width * shape.overlap.length
  else {
    const minWidth = Math.min(shape.leg1.width, shape.leg2.width)
    const minLength = Math.min(shape.leg1.length, shape.leg2.length)
    overlapArea = minWidth * minLength
  }
  return leg1Area + leg2Area - overlapArea
}

function calculateXShapeArea(shape: XShape): number {
  const centerArea = shape.center.width * shape.center.length
  const armsArea = shape.arms.reduce((total, arm) => total + arm.width * arm.length, 0)
  return centerArea + armsArea
}

function calculateUShapeArea(shape: UShape): number {
  return (
    shape.base.width * shape.base.length +
    shape.leftLeg.width * shape.leftLeg.length +
    shape.rightLeg.width * shape.rightLeg.length
  )
}

export function calculatePergolaArea(shape: PergolaShape): number {
  const validation = validatePergolaShape(shape)
  if (!validation.valid) {
    console.warn('[calculatePergolaArea] Invalid shape:', validation.errors)
    return 0
  }
  let area = 0
  switch (shape.type) {
    case 'rectangle':
      area = calculateRectangleArea(shape as RectangleShape)
      break
    case 'L':
      area = calculateLShapeArea(shape as LShape)
      break
    case 'X':
      area = calculateXShapeArea(shape as XShape)
      break
    case 'U':
      area = calculateUShapeArea(shape as UShape)
      break
    default:
      return 0
  }
  return Math.round(area * 100) / 100
}
