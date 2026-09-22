import { DEFAULT_PLAN_CONSTRUCTION_PARAMS, PERGOLA_PLAN_SCHEMA_VERSION } from '@pashkovsky/pergola-core'
import { DEFAULT_OFFER_VALUES, type OfferDraft, type Pergola } from '@/types/offer'
import { calculateOffer } from '@/lib/offer-calculator'
import { buildQuickOfferInsertRow } from '@/lib/quick-offer/build-quick-offer-row'
import {
  parseQuickOfferDraft,
  QUICK_OFFER_DRAFT_SCHEMA_VERSION,
  quickOfferSubmitTarget,
  serializeQuickOfferDraft,
} from '@/lib/quick-offer/draft-storage'

function pergola(polygon: Array<{ x: number; y: number }>, confirmed = true): Pergola {
  return {
    plan: {
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon,
      wallIndices: [0],
      params: { ...DEFAULT_PLAN_CONSTRUCTION_PARAMS },
      confirmed,
    },
    shape: { type: 'rectangle', width: 4, length: 6 },
    pergolaType: 'fixed',
    pricePerSqm: 750,
  }
}

function draftWith(pergolas: Pergola[]): OfferDraft {
  return {
    dealId: '',
    customerName: 'טיוטה',
    quickProduct: 'pergola',
    includePergola: true,
    includeRailings: false,
    includeFence: false,
    quickRailings: { ...DEFAULT_OFFER_VALUES.quickRailings },
    quickFence: { ...DEFAULT_OFFER_VALUES.quickFence },
    pergolas,
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
    options: { notes: 'keep-me' },
    vatPercent: 18,
    discountPercent: 0,
    images: [],
  }
}

const RECT = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 6000 },
  { x: 0, y: 6000 },
]

describe('quick offer draft storage', () => {
  it('round-trips drawings and offer id', () => {
    const draft = draftWith([pergola(RECT)])
    const raw = serializeQuickOfferDraft(draft, 'offer-abc')
    const restored = parseQuickOfferDraft(raw)
    expect(restored).not.toBeNull()
    expect(restored!.offerId).toBe('offer-abc')
    expect(restored!.draft.pergolas?.[0]?.plan?.polygon).toEqual(RECT)
    expect(restored!.draft.pergolas?.[0]?.plan?.confirmed).toBe(true)
    expect(restored!.draft.options?.notes).toBe('keep-me')
  })

  it('drops broken JSON without throwing', () => {
    expect(parseQuickOfferDraft('{not json')).toBeNull()
    expect(parseQuickOfferDraft('')).toBeNull()
    expect(parseQuickOfferDraft(null)).toBeNull()
  })

  it('drops a different schemaVersion', () => {
    const raw = JSON.stringify({
      schemaVersion: QUICK_OFFER_DRAFT_SCHEMA_VERSION + 1,
      offerId: null,
      draft: draftWith([pergola(RECT)]),
    })
    expect(parseQuickOfferDraft(raw)).toBeNull()
  })

  it('normalizes a broken plan to null and keeps the rest', () => {
    const draft = draftWith([pergola(RECT)])
    const raw = serializeQuickOfferDraft(draft, null)
    const broken = JSON.parse(raw) as { draft: { pergolas: Array<{ plan: { polygon: unknown } }> } }
    broken.draft.pergolas[0].plan.polygon = [{ x: 0, y: 0 }]
    const restored = parseQuickOfferDraft(JSON.stringify(broken))
    expect(restored!.draft.pergolas?.[0]?.plan).toBeNull()
    expect(restored!.draft.customerName).toBe('טיוטה')
    expect(restored!.draft.pergolas?.[0]?.pricePerSqm).toBe(750)
  })

  it('patches the same offer when an id is remembered', () => {
    expect(quickOfferSubmitTarget(null)).toEqual({ url: '/api/quick-offer', method: 'POST' })
    expect(quickOfferSubmitTarget('816f7130')).toEqual({
      url: '/api/quick-offer/816f7130',
      method: 'PATCH',
    })
  })

  it('does not write configurator_meta.planPolygon on a new quick offer row', () => {
    const draft = draftWith([pergola(RECT)])
    const calc = calculateOffer(draft)
    const row = buildQuickOfferInsertRow({
      dealId: 'deal-1',
      companyId: 'co-1',
      draft,
      includes: { pergola: true, railings: false, fence: false },
      normalizedPergolas: draft.pergolas ?? [],
      serverCalc: calc,
      quickOfferExtra: null,
    })
    expect(row).not.toHaveProperty('configurator_meta')
    expect(JSON.stringify(row)).not.toContain('planPolygon')
    const stored = row.pergolas_data as Pergola[]
    expect(stored[0].plan?.polygon).toEqual(RECT)
  })
})
