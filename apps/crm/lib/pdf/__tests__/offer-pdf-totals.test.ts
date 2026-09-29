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

  it('per-pergola addons: 2 pergolas, p1 has santaf+drainage+lighting, p2 bare', async () => {
    // Pергола 1: 4×6=24 m², 750 → 18 000
    // Сантеф с конструкцией: 24×450 → 10 800
    // Мрзб: 20 м × 500 → 10 000
    // LED: 12 м × 200 → 2 400
    // Пергола 2: 3×6=18 m², 750 → 13 500
    // Итого до НДС: 54 700; НДС 18% = 9 846; всего 64 546
    const draft: OfferDraft = {
      ...DEFAULT_OFFER_VALUES,
      dealId: '',
      customerName: 'Per-Pergola Test',
      quickProduct: 'pergola',
      includePergola: true,
      includeRailings: false,
      includeFence: false,
      pergolas: [
        {
          plan: null,
          shape: { type: 'rectangle', width: 4, length: 6 },
          pricePerSqm: 750,
          santaf: { enabled: true, pricePerSqm: 200 },   // 24 × 200 = 4 800
          drainage: { enabled: true, pricePerMeter: 500, runningMeters: 20 },
          lighting: { enabled: true, pricePerMeter: 200, runningMeters: 12 },
        },
        {
          plan: null,
          shape: { type: 'rectangle', width: 3, length: 6 },
          pricePerSqm: 750,
        },
      ],
      vatPercent: 18,
      discountPercent: 0,
    }

    const calc = calculateOffer(draft)

    // Santaf price = covered area × rate, no sheet overlap
    // 24 × 200 = 4 800; 18000+4800+10000+2400+13500 = 48 700
    expect(calc.pergolaTotal).toBe(31500)   // 18 000 + 13 500
    expect(calc.santafTotal).toBe(4800)     // 24 × 200
    expect(calc.drainageTotal).toBe(10000)  // 20 × 500
    expect(calc.lightingTotal).toBe(2400)   // 12 × 200
    expect(calc.totalBeforeVat).toBe(48700)
    expect(calc.vatAmount).toBeCloseTo(8766, 0)    // 48700 × 18%
    expect(calc.priceWithVat).toBeCloseTo(57466, 0) // 48700 × 1.18

    // PDF row sum = totalBeforeVat
    const offer: Offer = {
      ...draft, ...calc,
      id: 'per-pergola-test', offerNumber: '2026-TEST',
      termsSnapshot: buildCurrentOfferTermsSnapshot(),
      pergolas: draft.pergolas, pdf: {},
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    }
    const dict = pdfT.he
    const rows = collectOfferPdfLineRows(offer, dict)
    // 5 rows: pg1 (18000), santaf-pg1 (4800), drainage-pg1 (10000), led-pg1 (2400), pg2 (13500)
    expect(rows).toHaveLength(5)
    const printed = sumPdfLineTotals(rows.map(r => r.lineTotal))
    // Invariant: printed rows = totalBeforeVat
    expect(printed).toBe(48700)

    // Row labels contain pergola reference
    const descriptions = rows.map(r => r.description)
    expect(descriptions.some(d => d.includes('פרגולה 1') || d.includes('פרגולה #1'))).toBe(true)
  })

  it('point-6a: 4×6 m pergola + per-pergola santaf → 24 × 200 = 4 800', () => {
    const draft: OfferDraft = {
      ...DEFAULT_OFFER_VALUES,
      dealId: '', customerName: 'Test', quickProduct: 'pergola',
      includePergola: true, includeRailings: false, includeFence: false,
      pergolas: [{
        plan: null,
        shape: { type: 'rectangle', width: 4, length: 6 },
        pricePerSqm: 750,
        santaf: { enabled: true, pricePerSqm: 200 },
      }],
      vatPercent: 18, discountPercent: 0,
    }
    const calc = calculateOffer(draft)
    expect(calc.santafTotal).toBe(4800)   // 24 × 200
    expect(calc.totalBeforeVat).toBe(22800) // 18000 + 4800
  })

  it('point-6b: standalone santaf 4×6 on client pergola → 24 × 450 = 10 800', () => {
    const draft: OfferDraft = {
      ...DEFAULT_OFFER_VALUES,
      dealId: '', customerName: 'Test', quickProduct: 'pergola',
      includePergola: false, includeRailings: false, includeFence: false,
      santaf: {
        enabled: true,
        withStructure: true,         // true = standalone / client pergola = 450
        pricePerSqmBasic: 200,
        pricePerSqmWithStructure: 450,
        width: 4, length: 6,
        overlapType: 'double',
      },
      vatPercent: 18, discountPercent: 0,
    }
    const calc = calculateOffer(draft)
    expect(calc.santafTotal).toBe(10800)  // 24 × 450
  })

  it('fence 10m × 180cm × 350/m² + standard gate with decorative handle = 10 100', () => {
    // Fence: 10 × (180/100) × 350 = 18 m² × 350 = 6 300
    // Gate:  110 × 180 standard (≤120×180) → 3 500 + decorative 300 = 3 800
    // Total before VAT: 6 300 + 3 800 = 10 100
    const draft: OfferDraft = {
      ...DEFAULT_OFFER_VALUES,
      dealId: '',
      customerName: 'Gate Test',
      quickProduct: 'fence',
      includePergola: false,
      includeRailings: false,
      includeFence: true,
      quickFences: [
        {
          metersTotal: 10,
          heightCm: 180,
          fenceVariant: 'classic',
          color: 'שחור',
          pricePerSqm: 350,
          gates: [
            {
              widthCm: 110,
              heightCm: 180,
              decorativeHandle: true,
              pricePerUnit: 3500,
              nonStandard: false,
            },
          ],
        },
      ],
      vatPercent: 18,
      discountPercent: 0,
    }

    const calc = calculateOffer(draft)

    // Fence area: 10 × 1.80 = 18 m²
    expect(calc.fenceLineTotal).toBe(6300)
    // Gate: 3500 + 300 = 3800
    expect(calc.fenceGateTotal).toBe(3800)
    expect(calc.fenceGateLineTotals).toEqual([[3800]])
    expect(calc.totalBeforeVat).toBe(10100)
  })

  it('non-standard gate (width 130) fails validation', () => {
    const err = require('@/lib/quick-offer-product-validation').validateQuickFence({
      quickFences: [{
        metersTotal: 5, heightCm: 160, fenceVariant: 'classic', color: 'לבן', pricePerSqm: 350,
        gates: [{ widthCm: 130, heightCm: 160, decorativeHandle: false, pricePerUnit: undefined, nonStandard: true }],
      }],
    })
    expect(err).toContain('מידה לא סטנדרטית')
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
