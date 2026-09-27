import { DEFAULT_PLAN_CONSTRUCTION_PARAMS, PERGOLA_PLAN_SCHEMA_VERSION } from '@pashkovsky/pergola-core'
import { DEFAULT_OFFER_VALUES, type Offer, type OfferDraft } from '@/types/offer'
import { calculateOffer, quickOfferRailingsFenceAreaSqm } from '@/lib/offer-calculator'
import { buildCurrentOfferTermsSnapshot } from '@/lib/offers/offer-terms-snapshot'
import { collectOfferPdfLineRows } from '@/lib/pdf/offer-html-template'
import { pdfT } from '@/lib/pdf/offer-pdf-i18n'
import {
  OfferPdfTotalsMismatchError,
  pdfTotalsFromLineSubtotal,
  sumPdfLineTotals,
} from '@/lib/pdf/offer-pdf-totals'
import { renderOfferHtml } from '@/lib/pdf/offer-html-template'

function threeProductDraft(): OfferDraft {
  return {
    dealId: '',
    customerName: 'Totals Test',
    quickProduct: 'pergola',
    includePergola: true,
    includeRailings: true,
    includeFence: true,
    quickRailings: {
      metersTotal: 10,
      heightCm: 120,
      profileType: 'F50',
      color: 'אפור',
      locationType: 'balcony',
      glassType: '',
      glazingSystem: 'aluminum_glass',
      notes: '',
      pricePerSqm: 450,
    },
    quickFence: {
      metersTotal: 8,
      heightCm: 200,
      fenceVariant: 'classic',
      color: 'שחור',
      notes: '',
      pricePerSqm: 350,
    },
    pergolas: [
      {
        ...DEFAULT_OFFER_VALUES.pergola,
        shape: { type: 'rectangle', width: 4, length: 6 },
        pricePerSqm: 750,
      },
    ],
    color: { type: 'white' },
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

function draftToOffer(draft: OfferDraft, calc: ReturnType<typeof calculateOffer>): Offer {
  return {
    ...draft,
    ...calc,
    id: 'totals-test-offer',
    offerNumber: '2026-TOTALS',
    termsSnapshot: buildCurrentOfferTermsSnapshot(),
    pergolas: draft.pergolas,
    quickOfferExtra: {
      includePergola: true,
      includeRailings: true,
      includeFence: true,
      quickProduct: 'pergola',
      quickRailings: draft.quickRailings,
      quickFence: draft.quickFence,
      railingsLineTotal: calc.railingsLineTotal,
      fenceLineTotal: calc.fenceLineTotal,
    },
    pricing: {
      pergolaTotal: calc.pergolaTotal,
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
    createdAt: '2026-09-26T12:00:00.000Z',
    updatedAt: '2026-09-26T12:00:00.000Z',
  }
}

describe('offer PDF totals', () => {
  it('pergola + railings + fence: exact line sum, VAT, and stored totals align', async () => {
    const draft = threeProductDraft()
    const calc = calculateOffer(draft)

    const pergolaLine = 24 * 750
    const railSqm = quickOfferRailingsFenceAreaSqm(10, 120)
    const railLine = railSqm * 450
    const fenceSqm = quickOfferRailingsFenceAreaSqm(8, 200)
    const fenceLine = fenceSqm * 350

    expect(pergolaLine).toBe(18000)
    expect(railSqm).toBe(12)
    expect(railLine).toBe(5400)
    expect(fenceSqm).toBe(16)
    expect(fenceLine).toBe(5600)
    expect(calc.totalBeforeVat).toBe(29000)
    expect(calc.vatAmount).toBe(5220)
    expect(calc.priceWithVat).toBe(34220)

    const offer = draftToOffer(draft, calc)
    const dict = pdfT.he
    const rows = collectOfferPdfLineRows(offer, dict)
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => r.lineTotal).sort((a, b) => a - b)).toEqual([5400, 5600, 18000])

    const subtotal = sumPdfLineTotals(rows.map((r) => r.lineTotal))
    expect(subtotal).toBe(29000)

    const fromLines = pdfTotalsFromLineSubtotal(subtotal, 18)
    expect(fromLines.vatAmount).toBe(5220)
    expect(fromLines.priceWithVat).toBe(34220)

    const html = await renderOfferHtml(offer, null, true, 'he')
    expect(html).toContain('29,000')
    expect(html).toContain('5,220')
    expect(html).toContain('34,220')
  })

  it('trapezoid 3534/7030 × 3000 mm bills 15.85 m² × 750 = 11887.50', async () => {
    const draft = threeProductDraft()
    draft.includeRailings = false
    draft.includeFence = false
    draft.pergolas = [
      {
        plan: {
          schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
          polygon: [
            { x: 0, y: 0 },
            { x: 7030, y: 0 },
            { x: 5282, y: 3000 },
            { x: 1748, y: 3000 },
          ],
          wallIndices: [0],
          params: { ...DEFAULT_PLAN_CONSTRUCTION_PARAMS },
          confirmed: true,
        },
        shape: { type: 'rectangle', width: 7.03, length: 3 },
        pergolaType: 'fixed',
        pricePerSqm: 750,
      },
    ]
    const calc = calculateOffer(draft)
    expect(calc.area).toBe(15.85)
    expect(calc.pergolaTotal).toBe(11887.5)
    expect(calc.totalBeforeVat).toBe(11887.5)

    const offer = draftToOffer(draft, calc)
    offer.includeRailings = false
    offer.includeFence = false
    offer.quickOfferExtra = {
      includePergola: true,
      includeRailings: false,
      includeFence: false,
      quickProduct: 'pergola',
    }
    const rows = collectOfferPdfLineRows(offer, pdfT.he)
    expect(rows).toHaveLength(1)
    expect(rows[0].quantity).toBe(15.85)
    expect(rows[0].lineTotal).toBe(11887.5)
    expect(sumPdfLineTotals(rows.map((row) => row.lineTotal))).toBe(11887.5)

    const html = await renderOfferHtml(offer, null, true, 'he')
    expect(html).toContain('15.85')
    expect(html).toContain('11,887.50')
  })

  it('rejects PDF when stored total_before_vat disagrees with printed lines', async () => {
    const draft = threeProductDraft()
    const calc = calculateOffer(draft)
    const offer = draftToOffer(draft, calc)
    offer.totalBeforeVat = 18000

    await expect(renderOfferHtml(offer, null, true, 'he')).rejects.toMatchObject({
      linesSubtotal: 29000,
      storedTotalBeforeVat: 18000,
    })
  })
})
