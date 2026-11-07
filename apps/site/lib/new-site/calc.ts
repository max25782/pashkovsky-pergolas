import { calculatorConfig, type CalculatorConfig, type PergolaTypeId } from '@/config/siteCalculator'

export interface CalcInput {
  type: PergolaTypeId
  width: number
  depth: number
}

export interface CalcResult {
  area: number
  posts: number
  /** null for roof types without louvers. */
  louvers: number | null
  maxSpan: number
  priceMin: number
  priceMax: number
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step
}

/** Pure estimate. Every constant comes from config/siteCalculator.ts. */
export function calculate(input: CalcInput, config: CalculatorConfig = calculatorConfig): CalcResult {
  const type = config.types.find((t) => t.id === input.type) ?? config.types[0]
  const area = input.width * input.depth
  return {
    area,
    posts: (Math.ceil(input.width / config.postSpacingM) + 1) * 2,
    louvers: type.hasLouvers
      ? Math.floor((input.depth * 1000 + config.louverGapMm) / config.louverPitchMm)
      : null,
    maxSpan: Math.min(config.maxSpanM, input.width),
    priceMin: roundTo(area * type.ratePerM2.min, config.priceRoundTo),
    priceMax: roundTo(area * type.ratePerM2.max, config.priceRoundTo),
  }
}

export function formatPriceRange(result: CalcResult, config: CalculatorConfig = calculatorConfig): string {
  const fmt = (n: number): string => n.toLocaleString('en-US')
  return `${fmt(result.priceMin)} \u2013 ${fmt(result.priceMax)} ${config.currencySymbol}`
}
