/**
 * Proof PDF: pergola + railings + fence with aligned totals.
 * npx tsx scripts/proof-three-product-offer-pdf.ts
 */
import { resolve } from 'path'
import { mkdirSync, writeFileSync } from 'fs'
import { DEFAULT_OFFER_VALUES, type Offer, type OfferDraft } from '@/types/offer'
import { calculateOffer } from '@/lib/offer-calculator'
import { buildCurrentOfferTermsSnapshot } from '@/lib/offers/offer-terms-snapshot'
import { generateOfferPdf } from '@/lib/pdf/generate-offer-pdf'
import { renderOfferHtml } from '@/lib/pdf/offer-html-template'

function buildOffer(): Offer {
  const draft: OfferDraft = {
    dealId: '',
    customerName: 'דוד כהן — שלושה מוצרים',
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
  const calc = calculateOffer(draft)
  return {
    ...draft,
    ...calc,
    id: 'proof-three-product-2026-09-26',
    offerNumber: '2026-0003',
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
    createdAt: '2026-09-26T18:00:00.000Z',
    updatedAt: '2026-09-26T18:00:00.000Z',
  }
}

async function main() {
  const offer = buildOffer()
  const outDir = resolve(__dirname, '../../../docs/pdf-regenerated')
  mkdirSync(outDir, { recursive: true })
  const base = resolve(outDir, 'proof-three-product-2026-09-26')
  writeFileSync(`${base}.html`, await renderOfferHtml(offer, null, true, 'he'), 'utf8')
  writeFileSync(`${base}.pdf`, await generateOfferPdf(offer, 'he'))
  console.log('Wrote', `${base}.pdf`)
  console.log(
    'Totals:',
    offer.totalBeforeVat,
    'before VAT;',
    offer.vatAmount,
    'VAT;',
    offer.priceWithVat,
    'incl. VAT',
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
