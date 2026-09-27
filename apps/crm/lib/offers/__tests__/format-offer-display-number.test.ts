import { formatOfferDisplayNumber } from '@/lib/offers/format-offer-display-number'

describe('formatOfferDisplayNumber', () => {
  it('prefers explicit offerNumber from DB', () => {
    expect(
      formatOfferDisplayNumber({ id: 'any-uuid', offerNumber: '2026-0042' }),
    ).toBe('2026-0042')
  })

  it('matches PDF rule: last 8 digits of the offer UUID', () => {
    const id = '816f7130-aaaa-bbbb-cccc-ddddeeeeffff'
    expect(formatOfferDisplayNumber({ id })).toBe('08167130')
  })

  it('falls back to createdAt when id has few digits', () => {
    const createdAt = '2026-01-15T12:00:00.000Z'
    const n = formatOfferDisplayNumber({ id: 'x', createdAt })
    expect(n).toHaveLength(8)
    expect(/^\d{8}$/.test(n)).toBe(true)
  })
})
