import type { Offer } from '@/types/offer'

/** Canonical payment + lead time for installation offers (הזמנת עבודה / הצעת מחיר). */
export const STANDARD_INSTALLATION_ADVANCE_PERCENT = 20
export const STANDARD_INSTALLATION_REMAINING_PERCENT = 80
export const STANDARD_INSTALLATION_WORKING_DAYS_FROM_ADVANCE = 30

export const STANDARD_INSTALLATION_PAYMENT_TERMS: Offer['paymentTerms'] = {
  advancePercent: STANDARD_INSTALLATION_ADVANCE_PERCENT,
  remainingPercent: STANDARD_INSTALLATION_REMAINING_PERCENT,
  method: 'bankTransfer',
  text: `${STANDARD_INSTALLATION_ADVANCE_PERCENT}% מקדמה, ${STANDARD_INSTALLATION_REMAINING_PERCENT}% בסיום ההתקנה`,
}
