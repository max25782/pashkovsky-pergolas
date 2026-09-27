/**
 * Display / PDF offer number (not a DB column today).
 * Same algorithm as `formatOfferNumber` in offer-html-template — last 8 digits of the UUID.
 *
 * For per-company sequential numbers (e.g. 2026-0147), add `offers.offer_number`
 * via migration + allocator; do not derive from UUID once that exists.
 */
export interface OfferNumberSource {
  id: string
  createdAt?: string
  /** When set (DB `offers.offer_number`), used everywhere instead of UUID digits. */
  offerNumber?: string | null
}

export function formatOfferDisplayNumber(offer: OfferNumberSource): string {
  const explicit = offer.offerNumber?.trim()
  if (explicit) return explicit

  const digits = offer.id.replace(/\D/g, '')
  if (digits.length >= 8) return digits.slice(-8)
  if (digits.length >= 6) return digits.padStart(8, '0').slice(-8)
  if (offer.createdAt) {
    const ts = new Date(offer.createdAt).getTime()
    if (Number.isFinite(ts)) return String(ts % 100_000_000).padStart(8, '0')
  }
  if (offer.id.length >= 8) return offer.id.slice(0, 8)
  return offer.id
}
