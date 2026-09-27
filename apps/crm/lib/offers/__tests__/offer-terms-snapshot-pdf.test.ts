import { DEFAULT_OFFER_VALUES, type Offer, type OfferDraft } from '@/types/offer'
import { calculateOffer } from '@/lib/offer-calculator'
import { renderOfferHtml } from '@/lib/pdf/offer-html-template'
import type { OfferTermsSnapshot } from '@/lib/offers/offer-terms-snapshot'
import { STANDARD_INSTALLATION_ADVANCE_PERCENT } from '@/lib/commercial/standard-installation-terms'
import { buildCurrentOfferTermsSnapshot } from '@/lib/offers/offer-terms-snapshot'

function minimalOffer(termsSnapshot: OfferTermsSnapshot): Offer {
  const draft: OfferDraft = {
    dealId: '',
    customerName: 'Snap',
    quickProduct: 'pergola',
    includePergola: true,
    includeRailings: false,
    includeFence: false,
    quickRailings: { ...DEFAULT_OFFER_VALUES.quickRailings },
    quickFence: { ...DEFAULT_OFFER_VALUES.quickFence },
    pergolas: [{ ...DEFAULT_OFFER_VALUES.pergola, shape: { type: 'rectangle', width: 4, length: 6 } }],
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
  const calc = calculateOffer(draft)
  return {
    ...draft,
    ...calc,
    id: 'snap-offer',
    termsSnapshot,
    pergolas: draft.pergolas,
    pricing: {
      santafTotal: calc.santafTotal,
      zipScreenTotal: calc.zipScreenTotal,
      lightingTotal: calc.lightingTotal,
      drainageTotal: calc.drainageTotal,
      winterClosureTotal: calc.winterClosureTotal,
      totalBeforeVat: calc.totalBeforeVat,
      vatPercent: calc.vatPercent,
      vatAmount: calc.vatAmount,
      priceWithVat: calc.priceWithVat,
      discountPercent: calc.discountPercent,
      discountAmount: calc.discountAmount,
      finalPrice: calc.finalPrice,
    },
    paymentTerms: DEFAULT_OFFER_VALUES.paymentTerms,
    warranty: DEFAULT_OFFER_VALUES.warranty,
    approval: { approved: false },
    pdf: {},
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
  }
}

describe('offer terms snapshot in PDF', () => {
  it('renders payment rows from snapshot even when live constants differ', async () => {
    expect(STANDARD_INSTALLATION_ADVANCE_PERCENT).toBe(20)

    const snapshot: OfferTermsSnapshot = {
      textVersion: 1,
      advancePercent: 10,
      remainingPercent: 90,
      workingDaysFromAdvance: 35,
      warrantyYears: 7,
      warrantyRows: {
        he: [{ product: 'X', period: 'Y' }],
        en: [{ product: 'X', period: 'Y' }],
        ru: [{ product: 'X', period: 'Y' }],
      },
    }

    const html = await renderOfferHtml(minimalOffer(snapshot), null, true, 'he')
    expect(html).toContain('<td>10%</td>')
    expect(html).toContain('<td>90%</td>')
    expect(html).toContain('35 ימי עבודה')
    expect(html).not.toContain('<td>20%</td>')
  })

  it('v3 snapshot renders full legal sections with 20/80 and 30 working days', async () => {
    const snapshot = buildCurrentOfferTermsSnapshot()
    expect(snapshot.textVersion).toBe(3)
    const html = await renderOfferHtml(minimalOffer(snapshot), null, true, 'he')
    expect(html).toContain('תנאי ביצוע')
    expect(html).toContain('לוח זמנים ואספקה')
    for (let n = 1; n <= 16; n++) {
      expect(html).toContain(`terms-num">${n}.`)
    }
    expect(html).toContain('30 ימי עבודה')
    expect(html).toMatch(/<td>20%<\/td>/)
    expect(html).toMatch(/terms-table-block[\s\S]*אופציות תשלום/)
    expect(html).toContain('Pashkovsky Group · פתרונות אלומיניום · 052-449-4848')
  })

  it('v2 snapshot keeps simplified terms only (signed offers)', async () => {
    const snapshot = buildCurrentOfferTermsSnapshot()
    const v2 = { ...snapshot, textVersion: 2, legal: undefined }
    const html = await renderOfferHtml(minimalOffer(v2), null, true, 'he')
    expect(html).not.toContain('1. תנאי ביצוע')
    expect(html).toContain('30 ימי עבודה')
  })
})
