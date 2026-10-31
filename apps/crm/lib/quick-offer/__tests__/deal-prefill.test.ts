import { buildQuickOfferHref, parseQuickOfferPrefill } from '../deal-prefill'

describe('buildQuickOfferHref / parseQuickOfferPrefill', () => {
  it('round-trips the deal id and customer data', () => {
    const href = buildQuickOfferHref({
      dealId: '3f2b1c9e-1d2a-4b6c-8f00-1234567890ab',
      name: 'דוד כהן',
      phone: '050-1234567',
      city: 'חיפה',
    })
    expect(href.startsWith('/app/quick-offer?')).toBe(true)
    const parsed = parseQuickOfferPrefill(href.split('?')[1])
    expect(parsed).toEqual({
      dealId: '3f2b1c9e-1d2a-4b6c-8f00-1234567890ab',
      name: 'דוד כהן',
      phone: '050-1234567',
      city: 'חיפה',
    })
  })

  it('returns a plain path and null when there is nothing to prefill', () => {
    expect(buildQuickOfferHref({})).toBe('/app/quick-offer')
    expect(buildQuickOfferHref({ name: '   ' })).toBe('/app/quick-offer')
    expect(parseQuickOfferPrefill('')).toBeNull()
  })

  it('strips bidi marks, non-breaking spaces and U+2011 hyphens from a pasted phone', () => {
    const pasted = '\u202a+972\u00a052\u2011799\u20115598\u202c'
    const href = buildQuickOfferHref({ dealId: 'd1', phone: pasted })
    expect(parseQuickOfferPrefill(href.split('?')[1])?.phone).toBe('+972 52-799-5598')
  })

  it('still understands the lead link used by TodayQueue (name + phone, no deal)', () => {
    expect(parseQuickOfferPrefill('name=Dan&phone=0501234567')).toEqual({
      dealId: '',
      name: 'Dan',
      phone: '0501234567',
      city: '',
    })
  })

  it('drops a deal id that is not a plain identifier', () => {
    expect(parseQuickOfferPrefill('dealId=a%2Fb%3Fc&name=Dan')?.dealId).toBe('')
    expect(parseQuickOfferPrefill(`dealId=${'x'.repeat(80)}&name=Dan`)?.dealId).toBe('')
  })
})
