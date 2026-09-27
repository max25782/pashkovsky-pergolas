import {
  getCreateOfferPergolaSaveBlock,
  isCreateOfferPergolaSaveDisabled,
} from '@/lib/offers/create-offer-pergola-save-gate'
import { DEFAULT_OFFER_VALUES } from '@/types/offer'

describe('create offer pergola save gate', () => {
  it('blocks save when shape is null (default pergola after shape default removal)', () => {
    const pergola = { ...DEFAULT_OFFER_VALUES.pergola }
    expect(pergola.shape).toBeNull()
    expect(getCreateOfferPergolaSaveBlock([pergola])).toBe('missing_shape')
    expect(isCreateOfferPergolaSaveDisabled([pergola])).toBe(true)
  })

  it('allows save when rectangle shape has positive area', () => {
    const pergola = {
      ...DEFAULT_OFFER_VALUES.pergola,
      shape: { type: 'rectangle' as const, width: 4, length: 6 },
    }
    expect(getCreateOfferPergolaSaveBlock([pergola])).toBeNull()
    expect(isCreateOfferPergolaSaveDisabled([pergola])).toBe(false)
  })
})
