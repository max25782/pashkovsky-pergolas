/**
 * Pergola Area Calculations
 * Функции для расчета площади перголы различных форм
 */

import type { PergolaShape, RectangleShape, LShape, XShape, UShape } from '@/types/offer'

export interface ShapeValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Валидация формы перголы
 */
export function validatePergolaShape(shape: PergolaShape): ShapeValidationResult {
  const errors: string[] = []

  switch (shape.type) {
    case 'rectangle': {
      const rect = shape as RectangleShape
      if (!rect.width || rect.width <= 0) {
        errors.push('Ширина должна быть больше 0')
      }
      if (!rect.length || rect.length <= 0) {
        errors.push('Длина должна быть больше 0')
      }
      break
    }

    case 'L': {
      const lShape = shape as LShape
      if (!lShape.leg1?.width || lShape.leg1.width <= 0) {
        errors.push('Ширина первой ноги должна быть больше 0')
      }
      if (!lShape.leg1?.length || lShape.leg1.length <= 0) {
        errors.push('Длина первой ноги должна быть больше 0')
      }
      if (!lShape.leg2?.width || lShape.leg2.width <= 0) {
        errors.push('Ширина второй ноги должна быть больше 0')
      }
      if (!lShape.leg2?.length || lShape.leg2.length <= 0) {
        errors.push('Длина второй ноги должна быть больше 0')
      }
      break
    }

    case 'X': {
      const xShape = shape as XShape
      if (!xShape.center?.width || xShape.center.width <= 0) {
        errors.push('Ширина центра должна быть больше 0')
      }
      if (!xShape.center?.length || xShape.center.length <= 0) {
        errors.push('Длина центра должна быть больше 0')
      }
      if (!xShape.arms || xShape.arms.length === 0) {
        errors.push('Должна быть хотя бы одна рука')
      } else {
        xShape.arms.forEach((arm, index) => {
          if (!arm.width || arm.width <= 0) {
            errors.push(`Ширина руки ${index + 1} должна быть больше 0`)
          }
          if (!arm.length || arm.length <= 0) {
            errors.push(`Длина руки ${index + 1} должна быть больше 0`)
          }
        })
      }
      break
    }

    case 'U': {
      const uShape = shape as UShape
      if (!uShape.base?.width || uShape.base.width <= 0) {
        errors.push('Ширина основания должна быть больше 0')
      }
      if (!uShape.base?.length || uShape.base.length <= 0) {
        errors.push('Длина основания должна быть больше 0')
      }
      if (!uShape.leftLeg?.width || uShape.leftLeg.width <= 0) {
        errors.push('Ширина левой ноги должна быть больше 0')
      }
      if (!uShape.leftLeg?.length || uShape.leftLeg.length <= 0) {
        errors.push('Длина левой ноги должна быть больше 0')
      }
      if (!uShape.rightLeg?.width || uShape.rightLeg.width <= 0) {
        errors.push('Ширина правой ноги должна быть больше 0')
      }
      if (!uShape.rightLeg?.length || uShape.rightLeg.length <= 0) {
        errors.push('Длина правой ноги должна быть больше 0')
      }
      break
    }

    default:
      errors.push('Неизвестный тип формы')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Расчет площади прямоугольника
 */
function calculateRectangleArea(shape: RectangleShape): number {
  return shape.width * shape.length
}

/**
 * Расчет площади L-образной формы
 */
function calculateLShapeArea(shape: LShape): number {
  const leg1Area = shape.leg1.width * shape.leg1.length
  const leg2Area = shape.leg2.width * shape.leg2.length
  
  // Если есть overlap, вычитаем его (чтобы не считать дважды)
  let overlapArea = 0
  if (shape.overlap) {
    overlapArea = shape.overlap.width * shape.overlap.length
  } else {
    // Автоматический расчет пересечения (примерный)
    // Пересечение = минимальная ширина * минимальная длина
    const minWidth = Math.min(shape.leg1.width, shape.leg2.width)
    const minLength = Math.min(shape.leg1.length, shape.leg2.length)
    overlapArea = minWidth * minLength
  }
  
  return leg1Area + leg2Area - overlapArea
}

/**
 * Расчет площади X-образной формы
 */
function calculateXShapeArea(shape: XShape): number {
  const centerArea = shape.center.width * shape.center.length
  const armsArea = shape.arms.reduce((total, arm) => {
    return total + (arm.width * arm.length)
  }, 0)
  
  // Примерный расчет: центр + руки без учета пересечений
  // В реальности может потребоваться более сложная логика
  return centerArea + armsArea
}

/**
 * Расчет площади U-образной формы
 */
function calculateUShapeArea(shape: UShape): number {
  const baseArea = shape.base.width * shape.base.length
  const leftLegArea = shape.leftLeg.width * shape.leftLeg.length
  const rightLegArea = shape.rightLeg.width * shape.rightLeg.length
  
  // U-форма = основание + две ноги
  // Пересечения обычно минимальны, поэтому просто суммируем
  return baseArea + leftLegArea + rightLegArea
}

/**
 * Главная функция расчета площади перголы
 * @param shape - Форма перголы
 * @returns Площадь в квадратных метрах
 */
export function calculatePergolaArea(shape: PergolaShape): number {
  // Валидация перед расчетом
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
      console.error('[calculatePergolaArea] Unknown shape type:', (shape as any).type)
      return 0
  }

  // Округляем до 2 знаков после запятой
  return Math.round(area * 100) / 100
}

/**
 * Вспомогательная функция для получения описания формы
 */
export function getShapeDescription(shape: PergolaShape): string {
  switch (shape.type) {
    case 'rectangle':
      return `Прямоугольник ${shape.width}м × ${shape.length}м`
    case 'L':
      return `L-форма (${shape.leg1.width}×${shape.leg1.length}м + ${shape.leg2.width}×${shape.leg2.length}м)`
    case 'X':
      return `X-форма с центром ${shape.center.width}×${shape.center.length}м и ${shape.arms.length} руками`
    case 'U':
      return `U-форма (основание ${shape.base.width}×${shape.base.length}м)`
    default:
      return 'Неизвестная форма'
  }
}

