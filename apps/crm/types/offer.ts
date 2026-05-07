// Offer Types - Updated Structure for הצעת מחיר

// Pergola Product Types
export type PergolaProductType = 'fixed' | 'electricPvc' | 'electricBioclimatic'

export const PERGOLA_TYPE_NAMES: Record<PergolaProductType, string> = {
  fixed: 'פרגולה קבועה',
  electricPvc: 'פרגולה חשמלית PVC',
  electricBioclimatic: 'פרגולה חשמלית ביוקלמטיק',
}

export const PERGOLA_TYPE_DEFAULT_PRICES: Record<PergolaProductType, number> = {
  fixed: 750,
  electricPvc: 1500,
  electricBioclimatic: 3400,
}

// Pergola Shape Types
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
  overlap?: { width: number; length: number } // Опционально, для точности расчета пересечения
}

export interface XShape {
  type: 'X'
  center: { width: number; length: number }
  arms: Array<{
    direction: 'north' | 'south' | 'east' | 'west'
    width: number
    length: number
  }>
}

export interface UShape {
  type: 'U'
  base: { width: number; length: number }
  leftLeg: { width: number; length: number }
  rightLeg: { width: number; length: number }
}

export type PergolaShape = RectangleShape | LShape | XShape | UShape

export interface Pergola {
  shape: PergolaShape // Новая структура с поддержкой сложных форм
  pergolaType?: PergolaProductType // סוג פרגולה: קבועה / חשמלית PVC / ביוקלמטיק
  height?: number
  location?: string // מקום בבית
  pricePerSqm: number // Editable, default 750
  
  // Legacy fields для обратной совместимости (deprecated)
  /** @deprecated Use shape instead */
  width?: number
  /** @deprecated Use shape instead */
  length?: number
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
  width?: number // Dimensions when pergola is not included (מידות)
  length?: number // Dimensions when pergola is not included (מידות)
  overlapType?: 'single' | 'double' // Sheet overlap type: 'single' (1-wave) or 'double' (2-wave, recommended)
}

export interface ZipScreen {
  enabled: boolean
  type?: 'manual' | 'electric' // manual = 650 ₪/m², electric = 800 ₪/m²
  pricePerSqmManual: number // Default 650, editable
  pricePerSqmElectric: number // Default 800, editable
  runningMeters?: number // מטר רץ - для расчета (если нужно отдельно от area)
}

export interface WinterClosureItem {
  type: 'foldingGlass' | 'windows7000' | 'windows9000' | 'fixedGlass' | 'slidingShowcase7000' | 'slidingShowcase9000' | 'sliderGlass'
  area: number // שטח למ"ר
  pricePerSqm: number // מחיר למ"ר
  notes?: string // הערות (לאיזה צד, למשל)
}

export interface WinterClosure {
  enabled: boolean
  items: WinterClosureItem[] // רשימה של סוגי סגירה
  glassType?: 'tempered' | 'triplex' | 'insulated' // סוג זכוכית כללי לכולם
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

/** Quick Offer: primary product (defaults to pergola when omitted). */
export type QuickOfferProductType = 'pergola' | 'railings' | 'fence'

export type QuickOfferGlazingSystem = 'aluminum_glass' | 'wet_glazing' | 'dry_glazing'

export type QuickOfferFenceVariant = 'classic' | 'hitech' | 'hitech_angular'

export type QuickOfferRailingsLocation = 'balcony' | 'stairs' | 'roof' | 'yard' | 'other'

export interface QuickOfferRailingsDraft {
  metersTotal: number
  heightCm?: number
  profileType: string
  color: string
  locationType: QuickOfferRailingsLocation
  glassType?: string
  glazingSystem: QuickOfferGlazingSystem
  notes?: string
  /** ₪/m² — line total = areaSqm × pricePerSqm, areaSqm = metersTotal × (heightCm/100) */
  pricePerSqm: number
}

export interface QuickOfferFenceDraft {
  metersTotal: number
  heightCm?: number
  fenceVariant: QuickOfferFenceVariant
  color: string
  notes?: string
  /** ₪/m² — same area rule as railings */
  pricePerSqm: number
}

/** Stored on offers.quick_offer_extra for PDF / round-trip. */
export interface QuickOfferExtraPersisted {
  quickProduct: QuickOfferProductType
  quickRailings?: QuickOfferRailingsDraft
  quickFence?: QuickOfferFenceDraft
}

export interface Pricing {
  // Calculated values
  pergolaTotal?: number              // area * pricePerSqm
  santafTotal: number               // area * santaf price
  zipScreenTotal: number            // ZIP-экран
  lightingTotal: number             // תאורה
  drainageTotal: number             // ניקוז
  winterClosureTotal: number        // סגירת חורף (זכוכית)
  
  // Base totals
  totalBeforeVat: number            // sum of all before VAT
  vatPercent: number                // configurable % (e.g. 18)
  vatAmount: number                 // totalBeforeVat * (vatPercent/100)
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
  /** Locale used when this PDF was generated (`he` | `ru` | `en` | `sr`). */
  locale?: string
}

export interface ConfiguratorParams {
  shapeType?: 'rectangle' | 'L' | 'U'
  widthCm: number
  depthCm: number
  heightCm: number
  arm1WidthCm?: number
  arm1DepthCm?: number
  color: string
  lamellaAngleDeg: number
  attachedToWall: boolean
  lamellaGapCm: number
  beamLed: boolean
  lamellaStanding: boolean
  lamellaAlongWidth: boolean
  postProfileId?: string | null
  beamProfileId?: string | null
  dividerProfileId?: string | null
  lamellaProfileId?: string | null
}

export interface ConfiguratorMeta {
  /** Read-only 3D viewer URL for customers (PDF, public page) — includes `view=1`. */
  viewUrl?: string | null
  /** Full editor URL for staff (CRM) — same token, no `view=1`. */
  editUrl?: string | null
  previewImageUrl?: string | null
  lastSubmissionId?: string | null
  updatedAt?: string | null
  skippedNonRectangle?: boolean
  /** Full technical params from the last 3D configurator submission */
  params?: ConfiguratorParams | null
}

export interface OfferDraft {
  dealId: string
  customerName: string
  customerPhone?: string
  customerCity?: string

  // Support multiple pergolas in one offer
  pergolas?: Pergola[]
  // Legacy field for backward compatibility (deprecated - use pergolas array instead)
  /** @deprecated Use pergolas array instead */
  pergola?: Pergola
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
  
  // VAT rate (%) — applied to total before VAT
  vatPercent: number

  // Discount (applied after VAT)
  discountPercent: number

  images?: string[]

  configuratorMeta?: ConfiguratorMeta | null

  quickProduct?: QuickOfferProductType
  quickRailings?: QuickOfferRailingsDraft
  quickFence?: QuickOfferFenceDraft
}

export interface OfferCalculation {
  area: number
  pergolaTotal?: number
  /** Main line for Quick Offer when product is railings (₪). */
  railingsLineTotal?: number
  /** Main line for Quick Offer when product is fence (₪). */
  fenceLineTotal?: number
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

export interface Offer extends OfferDraft, OfferCalculation {
  id: string
  area: number
  /** Loaded from offers.quick_offer_extra when present. */
  quickOfferExtra?: QuickOfferExtraPersisted | null
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
    shape: {
      type: 'rectangle' as const,
      width: 4,
      length: 6,
    },
    pergolaType: 'fixed' as PergolaProductType,
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
    type: null as Roof['type'],
    santafColor: undefined as Roof['santafColor'],
  },
  shadingRatio: null as OfferDraft['shadingRatio'],
  finishType: null as OfferDraft['finishType'],
  finishValue: '' as OfferDraft['finishValue'],
  santaf: {
    enabled: false,
    withStructure: false,
    pricePerSqmBasic: 220,
    pricePerSqmWithStructure: 450,
    width: undefined,
    length: undefined,
    overlapType: 'double' as const, // Default to double overlap (manufacturer recommended)
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
    items: [],
    glassType: undefined
  },
  options: {
    notes: undefined
  },
  quickProduct: 'pergola' as QuickOfferProductType,
  quickRailings: {
    metersTotal: 10,
    heightCm: 120,
    profileType: '',
    color: '',
    locationType: 'balcony' as QuickOfferRailingsLocation,
    glassType: '',
    glazingSystem: 'aluminum_glass' as QuickOfferGlazingSystem,
    notes: '',
    pricePerSqm: 450,
  },
  quickFence: {
    metersTotal: 10,
    heightCm: 120,
    fenceVariant: 'classic' as QuickOfferFenceVariant,
    color: '',
    notes: '',
    pricePerSqm: 350,
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
    covers: ['צבע', 'קונסטרוקציה', 'סנטף']
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
