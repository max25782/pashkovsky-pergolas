/**
 * Calculator configuration for the new site (/new). The single source of every number the
 * calculator uses: components and lib/new-site/calc.ts contain no prices or constants.
 *
 * SAMPLE VALUES: `ratePerM2` are placeholders copied from the concept (ILS per m2).
 * Replace them with real rates before this goes live and set `isSample` to false.
 */
import type { Localized } from './siteTypes'

export type PergolaTypeId = 'louvered' | 'fixed' | 'carport'

export interface PergolaTypeConfig {
  id: PergolaTypeId
  label: Localized
  /** Only louvered roofs have a louver count. */
  hasLouvers: boolean
  ratePerM2: { min: number; max: number }
}

export interface RangeConfig {
  min: number
  max: number
  step: number
  initial: number
}

export interface CalculatorConfig {
  isSample: boolean
  currencySymbol: string
  width: RangeConfig
  depth: RangeConfig
  /** Approximate distance between posts along the width, in metres. */
  postSpacingM: number
  /** Largest span a single beam covers, in metres. */
  maxSpanM: number
  louverPitchMm: number
  louverGapMm: number
  /** Prices are rounded to the nearest multiple of this value. */
  priceRoundTo: number
  types: PergolaTypeConfig[]
}

export const calculatorConfig: CalculatorConfig = {
  isSample: true,
  currencySymbol: '\u20aa',
  width: { min: 2, max: 14, step: 0.1, initial: 6 },
  depth: { min: 2, max: 10, step: 0.1, initial: 4 },
  postSpacingM: 4,
  maxSpanM: 4,
  louverPitchMm: 90,
  louverGapMm: 20,
  priceRoundTo: 100,
  types: [
    { id: 'louvered', label: { he: 'עם למלות מתכווננות', en: 'Louvered' }, hasLouvers: true, ratePerM2: { min: 2200, max: 3200 } },
    { id: 'fixed', label: { he: 'קירוי קבוע', en: 'Fixed roof' }, hasLouvers: false, ratePerM2: { min: 1400, max: 2000 } },
    { id: 'carport', label: { he: 'קירוי לחניה', en: 'Carport' }, hasLouvers: false, ratePerM2: { min: 1100, max: 1700 } },
  ],
}
