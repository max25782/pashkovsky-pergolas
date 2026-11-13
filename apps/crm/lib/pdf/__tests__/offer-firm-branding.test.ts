import { DEFAULT_OFFER_VALUES, type Offer, type OfferDraft } from '@/types/offer'
import { calculateOffer } from '@/lib/offer-calculator'
import { renderOfferHtml } from '../offer-html-template'
import { buildCurrentOfferTermsSnapshot } from '@/lib/offers/offer-terms-snapshot'
import { buildOfferTermsLegalBlocks } from '@/lib/offers/offer-terms-legal-templates'
import { firmProfileFromRow } from '@/lib/company/firm-profile'
import { brandingForFirm } from '../firm-branding'

function offerWithTerms(firm?: Parameters<typeof buildCurrentOfferTermsSnapshot>[1]): Offer {
  const draft: OfferDraft = {
    dealId: '',
    customerName: 'Cust',
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
    id: 'brand-offer',
    termsSnapshot: buildCurrentOfferTermsSnapshot(7, firm),
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
  } as Offer
}

const PASHKOVSKY = firmProfileFromRow({
  name: 'Pashkovsky Group',
  phone: '052-449-4848',
  primary_email: 'office@pashkovsky-group.com',
  vat_number: '320807068',
  industry: 'aluminum',
})
const OTHER = firmProfileFromRow({
  name: 'Roof Masters',
  phone: '03-5551234',
  primary_email: 'hello@roofmasters.example',
  vat_number: '514000111',
  industry: 'roofing',
})
const LEAKS = /pashkovsky|052-449|320807068/i

describe('offer PDF carries only the issuing firm', () => {
  it("the first customer's PDF header shows its name, phone, e-mail and VAT id", async () => {
    const html = await renderOfferHtml(
      offerWithTerms(PASHKOVSKY),
      null,
      true,
      'he',
      await brandingForFirm(PASHKOVSKY),
    )
    expect(html).toContain('Pashkovsky Group')
    expect(html).toContain('052-449-4848')
    expect(html).toContain('office@pashkovsky-group.com')
    expect(html).toContain('320807068')
    expect(html).toContain('פתרונות אלומיניום')
  })

  it('another firm gets its own header and nothing from the first customer', async () => {
    const html = await renderOfferHtml(offerWithTerms(OTHER), null, true, 'he', await brandingForFirm(OTHER))
    expect(html).toContain('Roof Masters')
    expect(html).toContain('03-5551234')
    expect(html).toContain('514000111')
    expect(html).not.toMatch(LEAKS)
    // The aluminium tagline belongs to aluminium firms only.
    expect(html).not.toContain('פתרונות אלומיניום · pergolas')
  })

  it("the firm's PDF footer text is printed, and nothing is printed for a firm without one", async () => {
    const withFooter = firmProfileFromRow({ name: 'Foot Co', pdf_footer: 'Reg. 12345 <b>Haifa</b>' })
    const html = await renderOfferHtml(offerWithTerms(withFooter), null, true, 'he', await brandingForFirm(withFooter))
    expect(html).toContain('Reg. 12345 &lt;b&gt;Haifa&lt;/b&gt;')
    const none = await renderOfferHtml(offerWithTerms(OTHER), null, true, 'he', await brandingForFirm(OTHER))
    expect(none).not.toContain('Reg. 12345')
  })

  it('a firm with no VAT id or phone prints neither, not another firm\'s', async () => {
    const bare = firmProfileFromRow({ name: 'Bare Co', industry: 'construction' })
    const html = await renderOfferHtml(offerWithTerms(bare), null, true, 'he', await brandingForFirm(bare))
    expect(html).toContain('Bare Co')
    expect(html).not.toMatch(LEAKS)
  })

  it('legal text of a new offer names the issuing firm in all three languages', () => {
    const blocks = buildOfferTermsLegalBlocks({
      advancePercent: 20,
      remainingPercent: 80,
      workingDaysFromAdvance: 30,
      firm: OTHER,
    })
    for (const locale of ['he', 'en', 'ru'] as const) {
      const block = blocks[locale]
      expect(block.licensingItems.join(' ') + block.footerLine + block.introSubtitle).toContain('Roof Masters')
      expect(JSON.stringify(block)).not.toMatch(LEAKS)
    }
  })

  it('offers written before firm profiles still print the text they were issued with', () => {
    const legacy = buildOfferTermsLegalBlocks({ advancePercent: 20, remainingPercent: 80, workingDaysFromAdvance: 30 })
    expect(legacy.he.footerLine).toBe('Pashkovsky Group · פתרונות אלומיניום · 052-449-4848 · office@pashkovskygroup.com')
    expect(legacy.en.introSubtitle).toBe('Pashkovsky Group · aluminum solutions')
  })
})
