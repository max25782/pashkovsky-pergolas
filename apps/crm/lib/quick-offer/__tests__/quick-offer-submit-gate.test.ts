import { createQuickOfferSubmitGate } from '@/lib/quick-offer/quick-offer-submit-gate'

describe('createQuickOfferSubmitGate', () => {
  it('allows only one in-flight submit until released', () => {
    const gate = createQuickOfferSubmitGate()
    expect(gate.tryAcquire()).toBe(true)
    expect(gate.tryAcquire()).toBe(false)
    gate.release()
    expect(gate.tryAcquire()).toBe(true)
    gate.release()
  })
})
