jest.mock('@/lib/email', () => ({ sendEmail: jest.fn() }))
jest.mock('@/lib/whatsapp-send', () => ({ sendWhatsAppTemplate: jest.fn() }))

import {
  buildApprovalDealPatch,
  buildApprovalEmail,
  type DealForApproval,
} from '../offer-approval'

const NOW = '2026-10-08T19:00:00.000Z'
const contact = { customerName: 'גלעד', customerPhone: '0501234567' }

function deal(overrides: Partial<DealForApproval> = {}): DealForApproval {
  return {
    id: 'd1',
    source: 'quick_offer',
    stage: null,
    price: null,
    customer_phone: '',
    confirmed_date: null,
    created_by: 'u1',
    ...overrides,
  }
}

describe('buildApprovalDealPatch', () => {
  it('puts a hidden quick-offer deal on the board as "offer approved" with the offer price', () => {
    expect(buildApprovalDealPatch(deal(), { final_price: '20000' }, contact, NOW)).toEqual({
      source: 'quick_offer_saved',
      stage: 'offer_approved',
      price: 20000,
      customer_phone: '0501234567',
      confirmed_date: NOW,
    })
  })

  it('advances a regular deal still on offer, and leaves later stages alone', () => {
    expect(
      buildApprovalDealPatch(deal({ source: 'facebook', stage: 'offer' }), { final_price: 100 }, contact, NOW),
    ).toEqual({ stage: 'offer_approved' })
    expect(
      buildApprovalDealPatch(deal({ source: null, stage: 'production' }), { final_price: 100 }, contact, NOW),
    ).toBeNull()
  })

  it('does not move a deal back from a later stage and keeps its price and phone', () => {
    const patch = buildApprovalDealPatch(
      deal({
        source: 'quick_offer_saved',
        stage: 'production',
        price: 18000,
        customer_phone: '0529999999',
        confirmed_date: '2026-09-01T00:00:00Z',
      }),
      { final_price: 20000 },
      contact,
      NOW,
    )
    expect(patch).toEqual({ source: 'quick_offer_saved' })
  })

  it('advances a saved deal that is still before "offer approved"', () => {
    const patch = buildApprovalDealPatch(
      deal({ source: 'quick_offer_saved', stage: 'offer', price: 5 }),
      { final_price: 20000 },
      contact,
      NOW,
    )
    expect(patch?.stage).toBe('offer_approved')
    expect(patch?.price).toBeUndefined()
  })
})

describe('buildApprovalEmail', () => {
  it('escapes customer-provided text and shows the amount', () => {
    const { subject, html } = buildApprovalEmail({
      offerLabel: 'A-1',
      customerName: '<script>x</script>',
      customerPhone: null,
      amount: 171960,
      dealPromoted: true,
      offerUrl: 'https://x/he/offers/1/approve',
      boardUrl: 'https://x/app',
    })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('171,960')
    expect(html).toContain('הצעת מחיר מאושרת')
    expect(subject).toContain('171,960')
  })
})
