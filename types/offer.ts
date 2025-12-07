// Offer Types - Updated Structure for הצעת מחיר

export interface Pergola {
  width: number
  length: number
  height?: number
  location?: string // מקום בבית
  pricePerSqm: number // Editable, default 750
}

export interface Color {
  type: 'white' | 'black' | 'cream' | 'ral' | 'wood'
  ralCode?: string
  woodName?: string
}

export interface Roof {
  type: 'santaf' | 'triplexGlass' | null
  santafColor?: 'transparent' | 'gray' | 'white' | 'gold'
}

export interface Santaf {
  enabled: boolean
  withStructure: boolean // false = 220 ₪/m², true = 450 ₪/m²
  pricePerSqmBasic: number // Default 220, editable
  pricePerSqmWithStructure: number // Default 450, editable
}

export interface ZipScreen {
  enabled: boolean
  type?: 'manual' | 'electric' // manual = 650 ₪/m², electric = 800 ₪/m²
  pricePerSqmManual: number // Default 650, editable
  pricePerSqmElectric: number // Default 800, editable
  runningMeters?: number // מטר רץ - для расчета (если нужно отдельно от area)
}

export interface WinterClosure {
  enabled: boolean
  type?: 'foldingGlass' | 'windows7000' | 'windows9000'
  glassType?: 'tempered' | 'triplex' | 'insulated'
}

export interface Lighting {
  enabled: boolean
  pricePerMeter: number // Default 200, editable
  runningMeters?: number // מטר רץ
}

export interface Drainage {
  enabled: boolean
  pricePerMeter: number // Default 500, editable
  runningMeters?: number // מטר רץ
}

export interface Options {
  notes?: string
}

export interface Pricing {
  // Calculated values
  pergolaTotal: number              // area * pricePerSqm
  santafTotal: number               // area * santaf price
  zipScreenTotal: number            // ZIP-экран
  lightingTotal: number             // תאורה
  drainageTotal: number             // ניקוז
  
  // Base totals
  totalBeforeVat: number            // sum of all before VAT
  vatPercent: number                // 18%
  vatAmount: number                 // totalBeforeVat * 0.18
  priceWithVat: number              // totalBeforeVat + vatAmount
  
  // Discount (applied AFTER VAT)
  discountPercent: number           // Discount %
  discountAmount: number            // priceWithVat * (discountPercent/100)
  
  finalPrice: number                // priceWithVat - discountAmount
}

export interface PaymentTerms {
  advancePercent: number
  remainingPercent: number
  method: 'bankTransfer'
  text: string
}

export interface Warranty {
  years: number
  covers: string[]
}

export interface Approval {
  approved: boolean
  approvedAt?: string
  signatureImage?: string
  customerName?: string
  customerPhone?: string
}

export interface PDF {
  url?: string
  createdAt?: string
}

export interface OfferDraft {
  dealId: string
  customerName: string
  customerPhone?: string
  customerCity?: string
  
  pergola: Pergola
  color: Color
  roof: Roof
  shadingRatio?: '40/20' | '50/20' | '70/20' | null
  finishType?: 'ral' | 'wood' | null
  finishValue?: string | null
  santaf: Santaf
  zipScreen: ZipScreen
  lighting: Lighting
  drainage: Drainage
  winterClosure: WinterClosure
  options: Options
  
  // Discount (applied after VAT)
  discountPercent: number
  
  images?: string[]
}

export interface OfferCalculation {
  area: number
  pergolaTotal: number
  santafTotal: number
  zipScreenTotal: number
  lightingTotal: number
  drainageTotal: number
  totalBeforeVat: number
  vatAmount: number
  priceWithVat: number
  discountAmount: number
  finalPrice: number
}

export interface Offer extends OfferDraft, OfferCalculation {
  id: string
  area: number
  pricing: Pricing
  paymentTerms: PaymentTerms
  warranty: Warranty
  approval: Approval
  pdf: PDF
  createdAt: string
  updatedAt: string
}

export const DEFAULT_OFFER_VALUES = {
  pergola: {
    width: 4,
    length: 6,
    height: undefined,
    location: undefined,
    pricePerSqm: 750, // Default price
  },
  color: {
    type: 'white' as const,
    ralCode: undefined,
    woodName: undefined
  },
  roof: {
    type: 'santaf' as const,
    santafColor: 'transparent' as const
  },
  shadingRatio: null as OfferDraft['shadingRatio'],
  finishType: null as OfferDraft['finishType'],
  finishValue: '' as OfferDraft['finishValue'],
  santaf: {
    enabled: false,
    withStructure: false,
    pricePerSqmBasic: 220,
    pricePerSqmWithStructure: 450,
  },
  zipScreen: {
    enabled: false,
    type: undefined,
    pricePerSqmManual: 650,
    pricePerSqmElectric: 800,
    runningMeters: undefined,
  },
  lighting: {
    enabled: false,
    pricePerMeter: 200,
    runningMeters: undefined,
  },
  drainage: {
    enabled: false,
    pricePerMeter: 500,
    runningMeters: undefined,
  },
  winterClosure: {
    enabled: false,
    type: undefined,
    glassType: undefined
  },
  options: {
    notes: undefined
  },
  discountPercent: 0,
  vatPercent: 18, // Changed from 17% to 18%
  paymentTerms: {
    advancePercent: 10,
    remainingPercent: 90,
    method: 'bankTransfer' as const,
    text: '10% מקדמה וכל השאר בסיום התקנה בהעברה בנקאית'
  },
  warranty: {
    years: 7,
    covers: ['color', 'construction', 'santaf']
  },
  approval: {
    approved: false,
    approvedAt: undefined,
    signatureImage: undefined,
    customerName: undefined,
    customerPhone: undefined
  },
  pdf: {
    url: undefined,
    createdAt: undefined
  }
}

// Helper function to format price
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)
}
