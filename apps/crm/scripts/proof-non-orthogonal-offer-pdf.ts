/**
 * Local proof PDF (no DB): trapezoid plan + v3 terms + customer name.
 * npx tsx scripts/proof-non-orthogonal-offer-pdf.ts
 */
import { resolve } from 'path'
import { writeFileSync, mkdirSync } from 'fs'
import { DEFAULT_PLAN_CONSTRUCTION_PARAMS, PERGOLA_PLAN_SCHEMA_VERSION } from '@pashkovsky/pergola-core'
import { DEFAULT_OFFER_VALUES, type Offer, type OfferDraft, type Pergola } from '@/types/offer'
import { calculateOffer } from '@/lib/offer-calculator'
import { STANDARD_INSTALLATION_PAYMENT_TERMS } from '@/lib/commercial/standard-installation-terms'
import { buildCurrentOfferTermsSnapshot } from '@/lib/offers/offer-terms-snapshot'
import { generateOfferPdf } from '@/lib/pdf/generate-offer-pdf'
import { renderOfferHtml } from '@/lib/pdf/offer-html-template'

const TRAP_HEIGHT = 3000
const TRAP_LEFT_RUN = Math.sqrt(3849 ** 2 - TRAP_HEIGHT ** 2)
const TRAP_RIGHT_RUN = Math.sqrt(3190 ** 2 - TRAP_HEIGHT ** 2)
const TRAPEZOID = [
  { x: 0, y: 0 },
  { x: 7030, y: 0 },
  { x: 7030 - TRAP_RIGHT_RUN, y: TRAP_HEIGHT },
  { x: TRAP_LEFT_RUN, y: TRAP_HEIGHT },
]

function buildProofOffer(): Offer {
  const pergola: Pergola = {
    plan: {
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon: TRAPEZOID,
      wallIndices: [0],
      params: { ...DEFAULT_PLAN_CONSTRUCTION_PARAMS },
      confirmed: true,
    },
    shape: { type: 'rectangle', width: 4, length: 3 },
    pergolaType: 'fixed',
    pricePerSqm: 750,
  }
  const draft: OfferDraft = {
    dealId: '',
    customerName: 'דוד כהן — בדיקת PDF',
    quickProduct: 'pergola',
    includePergola: true,
    includeRailings: false,
    includeFence: false,
    quickRailings: { ...DEFAULT_OFFER_VALUES.quickRailings },
    quickFence: { ...DEFAULT_OFFER_VALUES.quickFence },
    pergolas: [pergola],
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
    id: 'proof-non-orthogonal-2026-09-26',
    offerNumber: '2026-0108',
    termsSnapshot: buildCurrentOfferTermsSnapshot(),
    pergolas: [pergola],
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
    paymentTerms: STANDARD_INSTALLATION_PAYMENT_TERMS,
    warranty: { years: 7, covers: [] },
    approval: { approved: false },
    pdf: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

async function main() {
  const offer = buildProofOffer()
  const outDir = resolve(__dirname, '../../../docs/pdf-regenerated')
  mkdirSync(outDir, { recursive: true })
  const base = resolve(outDir, 'proof-non-orthogonal-2026-09-26')
  const html = await renderOfferHtml(offer, null, true, 'he')
  writeFileSync(`${base}.html`, html, 'utf8')
  const pdf = await generateOfferPdf(offer, 'he')
  writeFileSync(`${base}.pdf`, pdf)
  console.log('Wrote', `${base}.pdf`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
