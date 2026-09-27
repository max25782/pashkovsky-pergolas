/**
 * Immutable commercial terms copied onto each offer at creation (POST).
 * PDF always renders from `termsSnapshot`; live constants only affect new offers + UI preview.
 */

import {
  STANDARD_INSTALLATION_ADVANCE_PERCENT,
  STANDARD_INSTALLATION_REMAINING_PERCENT,
  STANDARD_INSTALLATION_WORKING_DAYS_FROM_ADVANCE,
} from '@/lib/commercial/standard-installation-terms'
import {
  buildOfferTermsLegalBlocks,
  type OfferTermsLegalBlocks,
} from '@/lib/offers/offer-terms-legal-templates'

/** New offers: full legal block frozen in snapshot (v2 = shortened HTML only). */
export const OFFER_TERMS_TEXT_VERSION = 3

/** Offers already stored with simplified terms HTML only. */
export const OFFER_TERMS_TEXT_VERSION_V2 = 2

/** Legacy PDF terms (pre–2026-09 snapshot): 10/90, 35 working days — matches old `offer-terms-bodies`. */
export const OFFER_TERMS_TEXT_VERSION_LEGACY = 1

export interface OfferTermsWarrantyRow {
  product: string
  period: string
}

export interface OfferTermsSnapshot {
  textVersion: number
  advancePercent: number
  remainingPercent: number
  workingDaysFromAdvance: number
  warrantyYears: number
  warrantyRows: {
    he: OfferTermsWarrantyRow[]
    en: OfferTermsWarrantyRow[]
    ru: OfferTermsWarrantyRow[]
  }
  /** Present on textVersion 3+ offers created after full legal snapshot rollout. */
  legal?: OfferTermsLegalBlocks
}

const LEGACY_WARRANTY_HE: OfferTermsWarrantyRow[] = [
  { product: 'פרגולות אלומיניום — צבע, קונסטרוקציה', period: '7 שנים' },
  { product: 'סנטף BH (גג קבוע)', period: '7 שנים' },
  { product: 'סנטף פוליקרבונט', period: '2 שנים' },
  { product: 'מרזבים ואיטום', period: 'שנה ראשונה' },
  { product: 'ציוד חשמלי (מאווררים, LED)', period: 'שנה אחת' },
  { product: 'זכוכית מחוסמת', period: 'שנה אחת' },
]

const LEGACY_WARRANTY_EN: OfferTermsWarrantyRow[] = [
  { product: 'Aluminum pergolas — paint, structure', period: '7 years' },
  { product: 'Polycarbonate BH (fixed roof)', period: '7 years' },
  { product: 'Polycarbonate', period: '2 years' },
  { product: 'Gutters and sealing', period: 'first year' },
  { product: 'Electrical equipment (fans, LED)', period: '1 year' },
  { product: 'Tempered glass', period: '1 year' },
]

const LEGACY_WARRANTY_RU: OfferTermsWarrantyRow[] = [
  { product: 'Алюминиевые перголы — покраска, конструкция', period: '7 лет' },
  { product: 'Поликарбонат BH (стационарная крыша)', period: '7 лет' },
  { product: 'Поликарбонат', period: '2 года' },
  { product: 'Водостоки и герметизация', period: 'первый год' },
  { product: 'Электрооборудование (вентиляторы, LED)', period: '1 год' },
  { product: 'Закалённое стекло', period: '1 год' },
]

/** Terms used in PDF before per-offer snapshots (10% / 90%, 35 days). */
export const LEGACY_OFFER_TERMS_SNAPSHOT: OfferTermsSnapshot = {
  textVersion: OFFER_TERMS_TEXT_VERSION_LEGACY,
  advancePercent: 10,
  remainingPercent: 90,
  workingDaysFromAdvance: 35,
  warrantyYears: 7,
  warrantyRows: {
    he: LEGACY_WARRANTY_HE,
    en: LEGACY_WARRANTY_EN,
    ru: LEGACY_WARRANTY_RU,
  },
}

function currentWarrantyRows(): OfferTermsSnapshot['warrantyRows'] {
  return {
    he: LEGACY_WARRANTY_HE,
    en: LEGACY_WARRANTY_EN,
    ru: LEGACY_WARRANTY_RU,
  }
}

export function buildCurrentOfferTermsSnapshot(warrantyYears = 7): OfferTermsSnapshot {
  const advancePercent = STANDARD_INSTALLATION_ADVANCE_PERCENT
  const remainingPercent = STANDARD_INSTALLATION_REMAINING_PERCENT
  const workingDaysFromAdvance = STANDARD_INSTALLATION_WORKING_DAYS_FROM_ADVANCE
  return {
    textVersion: OFFER_TERMS_TEXT_VERSION,
    advancePercent,
    remainingPercent,
    workingDaysFromAdvance,
    warrantyYears,
    warrantyRows: currentWarrantyRows(),
    legal: buildOfferTermsLegalBlocks({
      advancePercent,
      remainingPercent,
      workingDaysFromAdvance,
    }),
  }
}

export function parseOfferTermsSnapshot(raw: unknown): OfferTermsSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.textVersion !== 'number') return null
  if (typeof o.advancePercent !== 'number' || typeof o.remainingPercent !== 'number') return null
  if (typeof o.workingDaysFromAdvance !== 'number') return null
  if (typeof o.warrantyYears !== 'number') return null
  const wr = o.warrantyRows
  if (!wr || typeof wr !== 'object') return null
  const rows = wr as Record<string, unknown>
  const parseRows = (key: string): OfferTermsWarrantyRow[] | null => {
    if (!Array.isArray(rows[key])) return null
    const out: OfferTermsWarrantyRow[] = []
    for (const item of rows[key]) {
      if (!item || typeof item !== 'object') return null
      const r = item as Record<string, unknown>
      if (typeof r.product !== 'string' || typeof r.period !== 'string') return null
      out.push({ product: r.product, period: r.period })
    }
    return out
  }
  const he = parseRows('he')
  const en = parseRows('en')
  const ru = parseRows('ru')
  if (!he || !en || !ru) return null
  const legalRaw = o.legal
  let legal: OfferTermsLegalBlocks | undefined
  if (legalRaw && typeof legalRaw === 'object') {
    const lr = legalRaw as Record<string, unknown>
    if (lr.he && lr.en && lr.ru) {
      legal = legalRaw as OfferTermsLegalBlocks
    }
  }
  return {
    textVersion: o.textVersion,
    advancePercent: o.advancePercent,
    remainingPercent: o.remainingPercent,
    workingDaysFromAdvance: o.workingDaysFromAdvance,
    warrantyYears: o.warrantyYears,
    warrantyRows: { he, en, ru },
    legal,
  }
}

export function resolveOfferTermsLegalBlocks(snapshot: OfferTermsSnapshot): OfferTermsLegalBlocks {
  if (snapshot.legal) return snapshot.legal
  return buildOfferTermsLegalBlocks({
    advancePercent: snapshot.advancePercent,
    remainingPercent: snapshot.remainingPercent,
    workingDaysFromAdvance: snapshot.workingDaysFromAdvance,
  })
}

/**
 * Rows without `terms_snapshot`: we only know they predate snapshots and matched legacy PDF (10/90, 35 days).
 * We cannot reconstruct company-specific or mid-life constant changes without a snapshot.
 */
export function resolveOfferTermsSnapshot(
  stored: unknown,
  _createdAt?: string,
): OfferTermsSnapshot {
  const parsed = parseOfferTermsSnapshot(stored)
  if (parsed) return parsed
  return LEGACY_OFFER_TERMS_SNAPSHOT
}
