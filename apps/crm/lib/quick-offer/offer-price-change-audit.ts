export interface OfferPriceChangeAuditPayload {
  fromFinalPrice: number
  toFinalPrice: number
}

export function buildOfferPriceChangeAuditChanges(
  payload: OfferPriceChangeAuditPayload,
): Record<string, { from: number; to: number }> {
  return {
    final_price: { from: payload.fromFinalPrice, to: payload.toFinalPrice },
  }
}

export function shouldLogOfferPriceChange(fromFinalPrice: number, toFinalPrice: number): boolean {
  return Number.isFinite(fromFinalPrice) && Number.isFinite(toFinalPrice) && fromFinalPrice !== toFinalPrice
}
