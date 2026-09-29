/**
 * Local proof PDF — per-pergola addons (5 lines):
 *   Pergola 1  4×6 m  750 ₪/m²       → 18 000
 *   Santaf (sheet calc 4×6 dbl)  450  → 14 107.50
 *   Drainage 20 m × 500          → 10 000
 *   LED      12 m × 200          → 2 400
 *   Pergola 2  3×6 m  750 ₪/m²       → 13 500
 *   Total before VAT              → 58 007.50
 *   VAT 18 %                     → 10 441.35
 *   Grand total                  → 68 448.85
 *
 * Run: npx tsx scripts/proof-per-pergola-addons.ts
 */
import { resolve } from 'path'
import { writeFileSync, mkdirSync } from 'fs'
import { DEFAULT_OFFER_VALUES, type Offer, type OfferDraft } from '@/types/offer'
import { calculateOffer } from '@/lib/offer-calculator'
import { STANDARD_INSTALLATION_PAYMENT_TERMS } from '@/lib/commercial/standard-installation-terms'
import { buildCurrentOfferTermsSnapshot } from '@/lib/offers/offer-terms-snapshot'
import { generateOfferPdf } from '@/lib/pdf/generate-offer-pdf'
import { renderOfferHtml } from '@/lib/pdf/offer-html-template'

const draft: OfferDraft = {
  ...DEFAULT_OFFER_VALUES,
  dealId: 'proof-per-pergola',
  customerName: 'בדיקת PDF — תוספות לפי פרגולה',
  quickProduct: 'pergola',
  includePergola: true,
  includeRailings: false,
  includeFence: false,
  pergolas: [
    {
      plan: null,
      shape: { type: 'rectangle', width: 4, length: 6 },
      pricePerSqm: 750,
      santaf: {
        enabled: true,
        pricePerSqm: 200,
      },
      drainage: { enabled: true, pricePerMeter: 500, runningMeters: 20 },
      lighting: { enabled: true, pricePerMeter: 200, runningMeters: 12 },
    },
    {
      plan: null,
      shape: { type: 'rectangle', width: 3, length: 6 },
      pricePerSqm: 750,
      // No per-pergola addons — pergola 2 is bare
    },
  ],
  vatPercent: 18,
  discountPercent: 0,
}

const calc = calculateOffer(draft)

console.log('=== Calculator output ===')
console.log('area:          ', calc.area)
console.log('pergolaTotal:  ', calc.pergolaTotal)
console.log('santafTotal:   ', calc.santafTotal)
console.log('drainageTotal: ', calc.drainageTotal)
console.log('lightingTotal: ', calc.lightingTotal)
console.log('totalBeforeVat:', calc.totalBeforeVat)
console.log('vatAmount:     ', calc.vatAmount)
console.log('priceWithVat:  ', calc.priceWithVat)

const offer: Offer = {
  ...draft,
  ...calc,
  id: 'proof-per-pergola-001',
  offerNumber: '2026-PROOF',
  termsSnapshot: buildCurrentOfferTermsSnapshot(),
  pergolas: draft.pergolas,
  pdf: {},
  paymentTerms: STANDARD_INSTALLATION_PAYMENT_TERMS,
  warranty: DEFAULT_OFFER_VALUES.warranty,
  approval: { approved: false },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  // Pricing mirrors OfferCalculation (spread above via calc)
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
}

async function main() {
  const html = await renderOfferHtml(offer, null, true, 'he')

  const dir = resolve(__dirname, '../docs/pdf-regenerated')
  mkdirSync(dir, { recursive: true })

  const htmlPath = resolve(dir, 'proof-per-pergola-addons.html')
  writeFileSync(htmlPath, html, 'utf-8')
  console.log('\nHTML written:', htmlPath)

  // Try PDF (pass offer object, not the HTML string)
  try {
    const pdfBuffer = await generateOfferPdf(offer, 'he')
    const pdfPath = resolve(dir, 'proof-per-pergola-addons.pdf')
    writeFileSync(pdfPath, pdfBuffer)
    console.log('PDF  written:', pdfPath)
  } catch (e) {
    console.error('PDF generation failed:', (e as Error).message.slice(0, 120))
    console.log('HTML is at:', htmlPath, '— open in browser to verify.')
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
