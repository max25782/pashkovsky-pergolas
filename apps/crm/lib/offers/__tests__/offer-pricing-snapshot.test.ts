import { DEFAULT_OFFER_VALUES, type Offer, type OfferDraft, type Pergola } from '@/types/offer'
import {
  calculateOffer,
  displayedShekels,
  parseDiscountPercent,
} from '@/lib/offer-calculator'
import { normalizePergola } from '@/lib/pergolas/normalize-pergola'
import { buildQuickOfferInsertRow } from '@/lib/quick-offer/build-quick-offer-row'
import { buildCurrentOfferTermsSnapshot } from '@/lib/offers/offer-terms-snapshot'
import {
  buildOfferPricingSnapshot,
  customerOfferMessage,
  offerPricedFromSnapshot,
} from '@/lib/offers/offer-pricing-snapshot'
import { collectOfferPdfLineRows, renderOfferHtml } from '@/lib/pdf/offer-html-template'
import { pdfT } from '@/lib/pdf/offer-pdf-i18n'
import { transformOfferFromDbRow } from '@/lib/pdf/map-offer-db-row-for-pdf'

function bhDraft(pricePerSqm: number): OfferDraft {
  const pergola: Pergola = {
    plan: null,
    shape: { type: 'rectangle', width: 12.47, length: 1 },
    pricePerSqm,
  }
  return {
    dealId: '',
    customerName: 'אגריקו',
    customerPhone: '0544787383',
    includePergola: true,
    includeRailings: false,
    includeFence: false,
    quickProduct: 'pergola',
    pergolas: [pergola],
    color: { ...DEFAULT_OFFER_VALUES.color },
    roof: { ...DEFAULT_OFFER_VALUES.roof },
    santaf: {
      enabled: true,
      withStructure: false,
      pricePerSqmBasic: 600,
      pricePerSqmWithStructure: 450,
    },
    zipScreen: { ...DEFAULT_OFFER_VALUES.zipScreen, enabled: false },
    lighting: { ...DEFAULT_OFFER_VALUES.lighting, enabled: false },
    drainage: { enabled: true, pricePerMeter: 500, runningMeters: 5 },
    winterClosure: { ...DEFAULT_OFFER_VALUES.winterClosure },
    options: { notes: undefined },
    vatPercent: 18,
    discountPercent: 27.5,
  }
}

function asOffer(draft: OfferDraft, calc = calculateOffer(draft)): Offer {
  const snapshot = buildOfferPricingSnapshot(draft, calc)
  return {
    ...draft,
    ...calc,
    id: '91055d8b-21e7-43d8-bbcf-957489678305',
    offerNumber: '2026-0039',
    termsSnapshot: buildCurrentOfferTermsSnapshot(),
    quickOfferExtra: {
      quickProduct: 'pergola',
      includePergola: true,
      pricingSnapshot: snapshot,
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
      discountPercent: snapshot.discountPercent,
      discountAmount: calc.discountAmount,
      finalPrice: calc.finalPrice,
    },
    paymentTerms: DEFAULT_OFFER_VALUES.paymentTerms,
    warranty: DEFAULT_OFFER_VALUES.warranty,
    approval: { approved: false },
    pdf: {},
    createdAt: '2026-10-31T12:00:00.000Z',
    updatedAt: '2026-10-31T12:00:00.000Z',
  }
}

function expectMoney(calc: ReturnType<typeof calculateOffer>, expected: {
  before: number
  vat: number
  withVat: number
  discount: number
  total: number
}) {
  expect(displayedShekels(calc.totalBeforeVat)).toBe(expected.before)
  expect(displayedShekels(calc.vatAmount)).toBe(expected.vat)
  expect(displayedShekels(calc.priceWithVat)).toBe(expected.withVat)
  expect(displayedShekels(calc.discountAmount)).toBe(expected.discount)
  expect(displayedShekels(calc.finalPrice)).toBe(expected.total)
  expect(calc.discountPercent).toBe(27.5)
}

describe('offer pricing snapshot', () => {
  it('empty pergola price: BH 7482 + drainage 2500, discount 27.5, no pergola line', async () => {
    const draft = bhDraft(0)
    const calc = calculateOffer(draft)
    expectMoney(calc, {
      before: 9982,
      vat: 1796.76,
      withVat: 11778.76,
      discount: 3239.16,
      total: 8539.6,
    })
    expect(calc.pergolaTotal).toBeUndefined()

    const snapshot = buildOfferPricingSnapshot(draft, calc)
    expect(snapshot.lines.map((line) => line.kind)).toEqual(['santaf', 'drainage'])
    expect(snapshot.lines.map((line) => line.lineTotal)).toEqual([7482, 2500])
    expect(snapshot.discountPercent).toBe(27.5)

    const offer = asOffer(draft, calc)
    offer.pergolas = [{ ...draft.pergolas![0], pricePerSqm: 750 }]
    const rows = collectOfferPdfLineRows(offer, pdfT.he)
    expect(rows.map((row) => row.lineTotal)).toEqual([7482, 2500])
    expect(rows.some((row) => row.unitPrice === 750)).toBe(false)

    const html = await renderOfferHtml(offer, null, true, 'he')
    expect(html).toContain('7,482.00')
    expect(html).toContain('2,500.00')
    expect(html).toContain('1,796.76')
    expect(html).toContain('11,778.76')
    expect(html).toContain('3,239.16')
    expect(html).toContain('8,539.60')
    expect(html).toContain('(27.5%)')
    expect(html).not.toContain('9,352.50')
    expect(html).not.toContain('750.00')

    const message = customerOfferMessage({
      customerName: 'אגריקו',
      offerUrl: 'https://app.example/he/offers/x/approve',
      snapshot,
    })
    expect(message).toContain('27.5%')
    expect(message).toContain('8,539.60')
    expect(message).not.toContain('פרגולה:')
    expect(message).not.toContain('750')
  })

  it('price 0 is the same as an empty price', () => {
    const empty = calculateOffer(bhDraft(0))
    const zero = calculateOffer({
      ...bhDraft(0),
      pergolas: [{ ...bhDraft(0).pergolas![0], pricePerSqm: Number('') || 0 }],
    })
    expect(displayedShekels(zero.finalPrice)).toBe(displayedShekels(empty.finalPrice))
    expect(buildOfferPricingSnapshot(bhDraft(0)).lines.some((line) => line.kind === 'pergola')).toBe(false)
  })

  it('offer 0039 at 1 ₪/m² keeps 27.5 and the 12.47 pergola line', async () => {
    const draft = bhDraft(1)
    const calc = calculateOffer(draft)
    expectMoney(calc, {
      before: 9994.47,
      vat: 1799,
      withVat: 11793.47,
      discount: 3243.21,
      total: 8550.27,
    })
    const rows = collectOfferPdfLineRows(asOffer(draft, calc), pdfT.he)
    expect(rows[0]).toMatchObject({ quantity: 12.47, unitPrice: 1, lineTotal: 12.47 })
    const html = await renderOfferHtml(asOffer(draft, calc), null, true, 'he')
    expect(html).toContain('9,994.47')
    expect(html).toContain('1,799.00')
    expect(html).toContain('3,243.21')
    expect(html).toContain('8,550.27')
    expect(html).toContain('(27.5%)')
    expect(html).not.toContain('(27%)')
  })

  it('saves 0 and 27.5, and a reload renders the snapshot rather than 750', () => {
    const draft = bhDraft(0)
    const calc = calculateOffer(draft)
    const row = buildQuickOfferInsertRow({
      dealId: 'deal-1',
      companyId: 'company-1',
      draft,
      includes: { pergola: true, railings: false, fence: false },
      normalizedPergolas: draft.pergolas ?? [],
      serverCalc: calc,
      quickOfferExtra: null,
      pricingSnapshot: buildOfferPricingSnapshot(draft, calc),
      customerName: 'אגריקו',
    })
    expect(row.pergola_price_per_sqm).toBe(0)
    expect(row.discount_percent).toBe(27.5)
    expect(row.pergola_total).toBe(0)
    expect(displayedShekels(row.final_price as number)).toBe(8539.6)
    const extra = row.quick_offer_extra as { pricingSnapshot: { lines: Array<{ kind: string }> } }
    expect(extra.pricingSnapshot.lines.some((line) => line.kind === 'pergola')).toBe(false)

    const loaded = transformOfferFromDbRow({
      ...row,
      id: 'offer-1',
      offer_number: '2026-0039',
      created_at: '2026-10-31T12:00:00.000Z',
      updated_at: '2026-10-31T12:00:00.000Z',
      pergola_price_per_sqm: 750,
      color_type: 'white',
      approved: false,
    })
    expect(offerPricedFromSnapshot(loaded)).toBe(true)
    expect(loaded.discountPercent).toBe(27.5)
    expect(displayedShekels(loaded.finalPrice)).toBe(8539.6)
    const rows = collectOfferPdfLineRows(loaded, pdfT.he)
    expect(rows.some((line) => line.unitPrice === 750)).toBe(false)
  })

  it('an old offer with no snapshot still defaults a missing price to 750', () => {
    expect(normalizePergola({ shape: { type: 'rectangle', width: 2, length: 3 } }).pricePerSqm).toBe(750)
    expect(normalizePergola({ pricePerSqm: 0, shape: { type: 'rectangle', width: 2, length: 3 } }).pricePerSqm).toBe(0)
    expect(normalizePergola({ pricePerSqm: '', shape: { type: 'rectangle', width: 2, length: 3 } }).pricePerSqm).toBe(0)
    expect(normalizePergola({ pricePerSqm: 1, shape: { type: 'rectangle', width: 2, length: 3 } }).pricePerSqm).toBe(1)
    expect(parseDiscountPercent('27.5')).toBe(27.5)
    expect(parseDiscountPercent('27,5')).toBe(27.5)
    expect(offerPricedFromSnapshot({ quickOfferExtra: null })).toBe(false)

    const legacy = normalizePergola({ shape: { type: 'rectangle', width: 2, length: 3 } })
    const draft = bhDraft(750)
    draft.pergolas = [legacy]
    draft.santaf = { ...draft.santaf, enabled: false }
    draft.drainage = { ...draft.drainage, enabled: false }
    draft.discountPercent = 0
    const offer = asOffer(draft)
    offer.quickOfferExtra = { quickProduct: 'pergola', includePergola: true }
    expect(offerPricedFromSnapshot(offer)).toBe(false)
    const rows = collectOfferPdfLineRows(offer, pdfT.he)
    expect(rows[0]).toMatchObject({ quantity: 6, unitPrice: 750, lineTotal: 4500 })
  })
})
