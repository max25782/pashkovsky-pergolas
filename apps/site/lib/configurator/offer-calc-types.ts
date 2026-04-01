/** Minimal types for offer pricing (vendored from CRM for site-side sync). */

export type PergolaShapeType = 'rectangle' | 'L' | 'X' | 'U'

export interface RectangleShape {
  type: 'rectangle'
  width: number
  length: number
}

export interface LShape {
  type: 'L'
  leg1: { width: number; length: number }
  leg2: { width: number; length: number }
  overlap?: { width: number; length: number }
}

export interface XShape {
  type: 'X'
  center: { width: number; length: number }
  arms: Array<{ direction: 'north' | 'south' | 'east' | 'west'; width: number; length: number }>
}

export interface UShape {
  type: 'U'
  base: { width: number; length: number }
  leftLeg: { width: number; length: number }
  rightLeg: { width: number; length: number }
}

export type PergolaShape = RectangleShape | LShape | XShape | UShape

export interface PergolaCalc {
  shape: PergolaShape
  height?: number
  location?: string
  pricePerSqm: number
  width?: number
  length?: number
}

export interface OfferDraftCalc {
  pergolas?: PergolaCalc[]
  pergola?: PergolaCalc
  santaf: {
    enabled: boolean
    withStructure: boolean
    pricePerSqmBasic: number
    pricePerSqmWithStructure: number
    width?: number
    length?: number
    overlapType?: 'single' | 'double'
  }
  zipScreen: {
    enabled: boolean
    type?: 'manual' | 'electric'
    pricePerSqmManual: number
    pricePerSqmElectric: number
    runningMeters?: number
  }
  lighting: { enabled: boolean; pricePerMeter: number; runningMeters?: number }
  drainage: { enabled: boolean; pricePerMeter: number; runningMeters?: number }
  winterClosure: {
    enabled: boolean
    items: Array<{ area: number; pricePerSqm: number }>
  }
  discountPercent: number
}

export interface OfferCalculation {
  area: number
  pergolaTotal?: number
  santafTotal: number
  zipScreenTotal: number
  lightingTotal: number
  drainageTotal: number
  winterClosureTotal: number
  totalBeforeVat: number
  vatPercent: number
  vatAmount: number
  priceWithVat: number
  discountPercent: number
  discountAmount: number
  finalPrice: number
}
