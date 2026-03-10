/**
 * modules/offers — Offer Generation & Lifecycle
 *
 * Canonical import path for all offers-related code.
 * New code should import from '@/modules/offers'.
 *
 * Responsibilities:
 *   - Offer calculation & pricing
 *   - PDF generation
 *   - Sharing (WhatsApp, email)
 *   - Approve/reject lifecycle
 */

// Types
export {
  type PergolaShapeType,
  type RectangleShape,
  type LShape,
  type XShape,
  type UShape,
  type PergolaShape,
  type Pergola,
  type Color,
  type Roof,
  type Santaf,
  type ZipScreen,
  type WinterClosureItem,
  type WinterClosure,
  type Lighting,
  type Drainage,
} from '@/types/offer'

// Calculator
export {
  calculateOffer,
  formatPrice,
} from '@/lib/offer-calculator'

// Sharing utilities
export {
  getOfferPublicUrl,
  formatPhoneForWhatsApp,
  sendOfferViaWhatsApp,
  openWhatsApp,
  getOfferEmailSubject,
  getOfferEmailBody,
} from '@/lib/offer-sharing'

// Winter closure pricing
export {
  WINTER_CLOSURE_PRICES,
  getWinterClosurePrice,
  calculateWinterClosureItemTotal,
  calculateWinterClosureTotalFromItems,
  getWinterClosureTypeName,
  getGlassTypeName,
  type WinterClosureType,
} from '@/lib/offers/winter-closure-pricing'

// PDF generation
export {
  generateOfferPdf,
  generateOfferPdfFilename,
} from '@/lib/pdf/generate-offer-pdf'

export { renderOfferHtml } from '@/lib/pdf/offer-html-template'

// UI Components
export { CreateOfferModal } from '@/components/offers/CreateOfferModal'
export { OffersList } from '@/components/offers/OffersList'
export { PergolaShapeSelector } from '@/components/offers/PergolaShapeSelector'
export { LShapeInput } from '@/components/offers/shapes/LShapeInput'
export { RectangleShapeInput } from '@/components/offers/shapes/RectangleShapeInput'
export { UShapeInput } from '@/components/offers/shapes/UShapeInput'
export { XShapeInput } from '@/components/offers/shapes/XShapeInput'
