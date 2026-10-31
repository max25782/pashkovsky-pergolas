import { applyVatAndDiscount } from '@/lib/offer-calculator'
import type { Offer } from '@/types/offer'

export class OfferPdfTotalsMismatchError extends Error {
  readonly code = 'OFFER_PDF_TOTALS_MISMATCH'

  constructor(
    public readonly linesSubtotal: number,
    public readonly storedTotalBeforeVat: number,
  ) {
    super(
      `Offer PDF line subtotal (${linesSubtotal}) does not match stored total before VAT (${storedTotalBeforeVat})`,
    )
    this.name = 'OfferPdfTotalsMismatchError'
  }
}

export interface OfferPdfTotalsFromLines {
  subtotalBeforeVat: number
  vatAmount: number
  priceWithVat: number
}

const MONEY_EPS = 0.02

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export function sumPdfLineTotals(lineTotals: number[]): number {
  return roundMoney(lineTotals.reduce((s, v) => s + v, 0))
}

/** Printed subtotal must match stored `total_before_vat` (after any reconcile). */
export function assertPdfSubtotalMatchesStored(
  linesSubtotal: number,
  offer: Pick<Offer, 'totalBeforeVat'>,
): void {
  const stored = roundMoney(Number(offer.totalBeforeVat) || 0)
  const lines = roundMoney(linesSubtotal)
  if (Math.abs(lines - stored) > MONEY_EPS) {
    throw new OfferPdfTotalsMismatchError(lines, stored)
  }
}

/**
 * Legacy PDF summary for offers that have no pricing snapshot.
 * VAT comes from `applyVatAndDiscount` (the same formula as the screen).
 * Cents are rounded per step so an old PDF stays byte-for-byte with the previous printer.
 */
export function pdfTotalsFromLineSubtotal(
  subtotalBeforeVat: number,
  vatPercent: number,
): OfferPdfTotalsFromLines {
  const sub = roundMoney(subtotalBeforeVat)
  const priced = applyVatAndDiscount(sub, vatPercent, 0)
  const vatAmount = roundMoney(priced.vatAmount)
  const priceWithVat = roundMoney(sub + vatAmount)
  return { subtotalBeforeVat: sub, vatAmount, priceWithVat }
}
