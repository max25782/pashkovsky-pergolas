// Offer Types - Updated Structure for הצעת מחיר

import type { PlanConstructionParams } from '@pashkovsky/pergola-core'
import { STANDARD_INSTALLATION_PAYMENT_TERMS } from '@/lib/commercial/standard-installation-terms'
import type { OfferTermsSnapshot } from '@/lib/offers/offer-terms-snapshot'
import {
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  PERGOLA_PLAN_SCHEMA_VERSION,
} from '@pashkovsky/pergola-core'

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

/** Vertex in the plan editor, millimeters. */
export interface PergolaPlanPointMm {
  x: number
  y: number
}

/** Construction / profile params saved with each pergola plan (plan editor). */
export type PergolaPlanConstructionParams = PlanConstructionParams

/**
 * 2D plan drawing for one pergola. Stored on `Pergola.plan` and in `offers.pergolas_data`.
 * Area and pricing for new offers are derived from `polygon` (not from `shape`).
 */
export interface PergolaPlan {
  schemaVersion: typeof PERGOLA_PLAN_SCHEMA_VERSION
  polygon: PergolaPlanPointMm[]
  wallIndices: number[]
  params: PergolaPlanConstructionParams
  /** User confirmed the drawing (אשר שרטוט) — unlocks pergola fields and offer submit. */
  confirmed: boolean
}

export { PERGOLA_PLAN_SCHEMA_VERSION }
export const DEFAULT_PERGOLA_PLAN_CONSTRUCTION_PARAMS = DEFAULT_PLAN_CONSTRUCTION_PARAMS

// ─── Per-pergola addon types ──────────────────────────────────────────────────

/**
 * Santaf (polycarbonate roof) settings scoped to a single pergola.
 * When the pergola is ours: one rate, no structure toggle.
 * pricePerSqm default 200 ₪/m² × covered area (not material/overlap area).
 */
export interface PergolaAddonSantaf {
  enabled: boolean
  /** ₪/m² × pergola covered area. Default 200 for our-pergola case. */
  pricePerSqm: number
}

/** Per-running-metre addon (מרזב / LED) scoped to a single pergola. */
export interface PergolaAddonMeter {
  enabled: boolean
  pricePerMeter: number
  runningMeters?: number
}

export interface Pergola {
  /**
   * Plan-editor drawing for this pergola. `null` until the user starts a new drawing.
   * New quick-offers: required with `confirmed: true` before submit.
   */
  plan: PergolaPlan | null
  /**
   * Legacy L/X/U/rectangle form input. Still used for old offers and PDF fallback when `plan` is absent.
   * New quick-offer pergolas start with `shape: null`.
   * @deprecated New offers: use `plan` only; do not rely on `shape` for area or pricing.
   */
  shape: PergolaShape | null
  pergolaType?: PergolaProductType // סוג פרגולה: קבועה / חשמלית PVC / ביוקלמטיק
  height?: number
  location?: string // מקום בבית
  pricePerSqm: number // Editable, default 750

  /**
   * Per-pergola סנטף. When present, overrides the offer-level `santaf` for this pergola.
   * Old offers without this field fall back to offer-level santaf (backward compat).
   */
  santaf?: PergolaAddonSantaf
  /**
   * Per-pergola מרזב (drainage). When present, overrides offer-level `drainage`.
   */
  drainage?: PergolaAddonMeter
  /**
   * Per-pergola LED lighting. When present, overrides offer-level `lighting`.
   */
  lighting?: PergolaAddonMeter

  // Legacy fields для обратной совместимости (deprecated)
  /** @deprecated Use plan polygon for dimensions */
  width?: number
  /** @deprecated Use plan polygon for dimensions */
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

/**
 * Standalone (offer-level) santaf — used when includePergola = false.
 * Two cases:
 *   withStructure = false → 200 ₪/m²  (our pergola, pricePerSqmBasic)
 *   withStructure = true  → 450 ₪/m²  (client's existing pergola, pricePerSqmWithStructure)
 * Area is always covered area (pergolaAreaSqm or manual width×length), not material area.
 */
export interface Santaf {
  enabled: boolean
  withStructure: boolean
  pricePerSqmBasic: number          // Default 200 (our pergola companion)
  pricePerSqmWithStructure: number  // Default 450 (standalone on client's pergola)
  width?: number   // Manual dimensions when pergola not included
  length?: number
  overlapType?: 'single' | 'double' // Used only for cutting list (calculateSuntufSheets), not for price
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

// ─── Fence gate (pedestrian) ──────────────────────────────────────────────────

/** Pricing constants for pedestrian gates inside fence sections. */
export const GATE_STANDARD_MAX_WIDTH_CM  = 120
export const GATE_STANDARD_MAX_HEIGHT_CM = 180
export const GATE_STANDARD_PRICE         = 3_500   // ₪/unit, includes lock + standard handle
export const GATE_DECORATIVE_HANDLE_SURCHARGE = 300 // ₪/unit

export interface FenceGate {
  widthCm: number
  heightCm: number
  decorativeHandle: boolean
  /**
   * Price per unit, ₪.
   * For standard sizes the UI pre-fills 3 500 but the salesperson may edit.
   * For non-standard (widthCm > 120 or heightCm > 180) this is mandatory.
   */
  pricePerUnit?: number
  /** True when widthCm > GATE_STANDARD_MAX_WIDTH_CM || heightCm > GATE_STANDARD_MAX_HEIGHT_CM */
  nonStandard: boolean
}

/** Total price for one gate (base + decorative handle surcharge). */
export function gateUnitTotal(gate: FenceGate): number {
  const base = gate.pricePerUnit ?? 0
  return base + (gate.decorativeHandle ? GATE_DECORATIVE_HANDLE_SURCHARGE : 0)
}

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
  /** Pedestrian gates in this fence section. Color and fenceVariant are inherited from the section. */
  gates?: FenceGate[]
}

/** Stored on offers.quick_offer_extra for PDF / round-trip. */
export interface QuickOfferExtraPersisted {
  quickProduct: QuickOfferProductType
  includePergola?: boolean
  includeRailings?: boolean
  includeFence?: boolean
  quickRailings?: QuickOfferRailingsDraft
  /** @deprecated Use quickFences array instead */
  quickFence?: QuickOfferFenceDraft
  /** Multiple fence sections in one offer. */
  quickFences?: QuickOfferFenceDraft[]
  /** Persisted line totals for mixed offers (PDF). */
  railingsLineTotal?: number
  fenceLineTotal?: number
  /** Per-section fence line totals (matches quickFences index). */
  fenceLineTotals?: number[]
  /**
   * Per-section gate line totals: fenceGateLineTotals[sectionIdx][gateIdx].
   * Each value = gate base price + handle surcharge.
   */
  fenceGateLineTotals?: number[][]
  /** Sum of all gate totals across all fence sections. */
  fenceGateTotal?: number
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
  hangingPergola?: boolean
  hangerCount?: number
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
  /**
   * Legacy single-plan snapshot on the offer row (pre per-pergola `Pergola.plan`).
   * Do not write for new offers. PDF/drawing code may read as fallback for old data.
   */
  planPolygon?: PergolaPlanPointMm[] | null
  planWallIndices?: number[] | null
  planParams?: PergolaPlanConstructionParams | null
  submissionId?: string | null
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
  /** Multi-product quick offer (when set, overrides exclusive quickProduct). */
  includePergola?: boolean
  includeRailings?: boolean
  includeFence?: boolean
  quickRailings?: QuickOfferRailingsDraft
  /** @deprecated Use quickFences array instead */
  quickFence?: QuickOfferFenceDraft
  /** Multiple fence sections — replaces the single quickFence field. */
  quickFences?: QuickOfferFenceDraft[]
}

export interface OfferCalculation {
  area: number
  pergolaTotal?: number
  /** Main line for Quick Offer when product is railings (₪). */
  railingsLineTotal?: number
  /** Combined total for all fence sections (₪). */
  fenceLineTotal?: number
  /** Per-section fence line totals — matches quickFences index. */
  fenceLineTotals?: number[]
  /** Per-section, per-gate totals. fenceGateLineTotals[sectionIdx][gateIdx]. */
  fenceGateLineTotals?: number[][]
  /** Sum of all gate totals. Added to totalBeforeVat. */
  fenceGateTotal?: number
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
  /** Per-company sequential number (e.g. 2026-0001). Null for legacy rows. */
  offerNumber?: string | null
  /** Frozen commercial terms for PDF; set on POST only. */
  termsSnapshot?: OfferTermsSnapshot | null
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
    plan: null,
    shape: null,
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
    pricePerSqmBasic: 200,
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
  paymentTerms: STANDARD_INSTALLATION_PAYMENT_TERMS,
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
