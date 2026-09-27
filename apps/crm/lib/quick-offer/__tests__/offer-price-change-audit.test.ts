import {
  buildOfferPriceChangeAuditChanges,
  shouldLogOfferPriceChange,
} from '@/lib/quick-offer/offer-price-change-audit'

describe('offer price change audit', () => {
  it('logs only when final price changes', () => {
    expect(shouldLogOfferPriceChange(10000, 12000)).toBe(true)
    expect(shouldLogOfferPriceChange(10000, 10000)).toBe(false)
  })

  it('builds audit changes payload', () => {
    expect(buildOfferPriceChangeAuditChanges({ fromFinalPrice: 10000, toFinalPrice: 12000 })).toEqual({
      final_price: { from: 10000, to: 12000 },
    })
  })
})
