import { DEFAULT_PLAN_CONSTRUCTION_PARAMS, PERGOLA_PLAN_SCHEMA_VERSION } from '@pashkovsky/pergola-core'
import { DEFAULT_OFFER_VALUES, type OfferDraft, type Pergola } from '@/types/offer'
import {
  isQuickOfferFormBlocked,
  shouldWarnQuickOfferCustomerRename,
} from '@/lib/quick-offer/quick-offer-edit-session'
import {
  parseQuickOfferDraft,
  serializeQuickOfferDraft,
} from '@/lib/quick-offer/draft-storage'

function pergola(): Pergola {
  return {
    plan: {
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon: [
        { x: 0, y: 0 },
        { x: 4000, y: 0 },
        { x: 4000, y: 6000 },
        { x: 0, y: 6000 },
      ],
      wallIndices: [],
      params: { ...DEFAULT_PLAN_CONSTRUCTION_PARAMS },
      confirmed: true,
    },
    shape: null,
    pricePerSqm: 750,
  }
}

describe('quick offer edit session', () => {
  it('blocks the form until the existing-offer banner is acknowledged', () => {
    expect(isQuickOfferFormBlocked('offer-uuid', false)).toBe(true)
    expect(isQuickOfferFormBlocked('offer-uuid', true)).toBe(false)
    expect(isQuickOfferFormBlocked(null, false)).toBe(false)
  })

  function minimalDraft(customerName: string): OfferDraft {
    return {
      dealId: '',
      customerName,
      quickProduct: 'pergola',
      includePergola: true,
      includeRailings: false,
      includeFence: false,
      quickRailings: { ...DEFAULT_OFFER_VALUES.quickRailings },
      quickFence: { ...DEFAULT_OFFER_VALUES.quickFence },
      pergolas: [pergola()],
      color: { ...DEFAULT_OFFER_VALUES.color },
      roof: { ...DEFAULT_OFFER_VALUES.roof },
      shadingRatio: null,
      finishType: null,
      finishValue: '',
      santaf: { ...DEFAULT_OFFER_VALUES.santaf },
      zipScreen: { ...DEFAULT_OFFER_VALUES.zipScreen },
      lighting: { ...DEFAULT_OFFER_VALUES.lighting },
      drainage: { ...DEFAULT_OFFER_VALUES.drainage },
      winterClosure: { ...DEFAULT_OFFER_VALUES.winterClosure },
      options: {},
      vatPercent: 18,
      discountPercent: 0,
      images: [],
    }
  }

  it('after submit, re-open shows offerId and requires acknowledge before edit', () => {
    const draft = minimalDraft('דני')
    const raw = serializeQuickOfferDraft(draft, '816f7130-aaaa-bbbb-cccc-ddddeeeeffff')
    const restored = parseQuickOfferDraft(raw)
    expect(restored?.offerId).toBe('816f7130-aaaa-bbbb-cccc-ddddeeeeffff')
    expect(isQuickOfferFormBlocked(restored!.offerId, false)).toBe(true)
    expect(isQuickOfferFormBlocked(restored!.offerId, true)).toBe(false)
  })

  it('start new offer clears offerId from storage envelope', () => {
    const draft = minimalDraft('הצעה מהירה')
    const cleared = serializeQuickOfferDraft(draft, null)
    expect(parseQuickOfferDraft(cleared)?.offerId).toBeNull()
  })

  it('warns when customer name changes on a bound offer', () => {
    expect(shouldWarnQuickOfferCustomerRename('id', 'דני', 'שרה')).toBe(true)
    expect(shouldWarnQuickOfferCustomerRename('id', 'דני', 'דני')).toBe(false)
    expect(shouldWarnQuickOfferCustomerRename(null, 'דני', 'שרה')).toBe(false)
  })
})
