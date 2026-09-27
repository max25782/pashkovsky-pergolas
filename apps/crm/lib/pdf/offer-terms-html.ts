import type { PdfDict } from '@/lib/pdf/offer-pdf-i18n'
import type { PdfLocale } from '@/lib/pdf/pdf-locale'
import type { OfferTermsSnapshot } from '@/lib/offers/offer-terms-snapshot'
import {
  OFFER_TERMS_TEXT_VERSION_V2,
  resolveOfferTermsLegalBlocks,
} from '@/lib/offers/offer-terms-snapshot'
import { pickOfferTermsLegalBlock } from '@/lib/offers/offer-terms-legal-templates'

function fillTpl(s: string, vars: Record<string, string | number>): string {
  let out = s
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, String(v))
  }
  return out
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

interface TermsTableRow {
  cells: string[]
}

function termsTableHtml(headers: string[], rows: TermsTableRow[]): string {
  const head = `<tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`
  const body = rows
    .map((r) => `<tr>${r.cells.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
    .join('')
  return `<table class="lines terms-table">${head}${body}</table>`
}

/** Global clause numbers (v3 full legal: 1–16, no gaps). */
function numberedParagraphs(items: string[], startNumber: number): string {
  return items
    .map(
      (item, i) =>
        `<p class="terms-p terms-num">${startNumber + i}. ${escapeHtml(item)}</p>`,
    )
    .join('')
}

/** Section titles in templates use "1. …" for outline; clause numbers are separate 1–16. */
function legalSectionHeading(title: string): string {
  return title.replace(/^\d+\.\s*/, '')
}

function renderSimplifiedTermsHtml(
  locale: PdfLocale,
  dict: PdfDict,
  snapshot: OfferTermsSnapshot,
): string {
  const payHeaders = [dict.off_terms_pay_pct, dict.off_terms_pay_stage, dict.off_terms_pay_when]
  const payRows: TermsTableRow[] = [
    {
      cells: [
        `${snapshot.advancePercent}%`,
        dict.off_terms_pay_deposit,
        dict.off_terms_pay_on_approval,
      ],
    },
    {
      cells: [
        `${snapshot.remainingPercent}%`,
        dict.off_terms_pay_final,
        dict.off_terms_pay_on_install_done,
      ],
    },
  ]

  const warrantyHeaders = [dict.off_terms_warranty_product, dict.off_terms_warranty_period]
  const warrantyRows =
    locale === 'he'
      ? snapshot.warrantyRows.he
      : locale === 'ru'
        ? snapshot.warrantyRows.ru
        : snapshot.warrantyRows.en

  const scheduleLine = fillTpl(dict.off_terms_schedule_days, {
    d: snapshot.workingDaysFromAdvance,
  })

  const tail = fillTpl(dict.off_valid_30, { y: String(snapshot.warrantyYears) })

  const warrantyTableRows: TermsTableRow[] = warrantyRows.map((r) => ({
    cells: [r.product, r.period],
  }))

  return `
  <div class="terms">
    <strong>${dict.off_terms_title}</strong>
    <p class="terms-intro">${escapeHtml(dict.off_terms_intro)}</p>
    <h3 class="terms-h3">${dict.off_terms_section_schedule}</h3>
    <p class="terms-p">${escapeHtml(scheduleLine)}</p>
    <h3 class="terms-h3">${dict.off_terms_section_payment}</h3>
    <div class="terms-table-block">
      ${termsTableHtml(payHeaders, payRows)}
      <p class="terms-p">${escapeHtml(dict.off_terms_payment_options)}</p>
    </div>
    <h3 class="terms-h3">${dict.off_terms_section_warranty}</h3>
    <div class="terms-table-block">
      ${termsTableHtml(warrantyHeaders, warrantyTableRows)}
    </div>
    <p class="terms-p">${escapeHtml(dict.off_terms_warranty_note)}</p>
    <div class="terms-tail">${escapeHtml(tail)}</div>
  </div>`
}

function renderFullLegalTermsHtml(
  locale: PdfLocale,
  dict: PdfDict,
  snapshot: OfferTermsSnapshot,
): string {
  const legal = pickOfferTermsLegalBlock(locale, resolveOfferTermsLegalBlocks(snapshot))
  const payHeaders = [dict.off_terms_pay_pct, dict.off_terms_pay_stage, dict.off_terms_pay_when]
  const payRows: TermsTableRow[] = [
    {
      cells: [
        `${snapshot.advancePercent}%`,
        dict.off_terms_pay_deposit,
        dict.off_terms_pay_on_approval,
      ],
    },
    {
      cells: [
        `${snapshot.remainingPercent}%`,
        dict.off_terms_pay_final,
        dict.off_terms_pay_on_install_done,
      ],
    },
  ]

  const warrantyHeaders = [dict.off_terms_warranty_product, dict.off_terms_warranty_period]
  const warrantyRows =
    locale === 'he'
      ? snapshot.warrantyRows.he
      : locale === 'ru'
        ? snapshot.warrantyRows.ru
        : snapshot.warrantyRows.en
  const warrantyTableRows: TermsTableRow[] = warrantyRows.map((r) => ({
    cells: [r.product, r.period],
  }))

  const tail = fillTpl(dict.off_valid_30, { y: String(snapshot.warrantyYears) })

  return `
  <div class="terms terms-full">
    <strong>${escapeHtml(legal.introTitle)}</strong>
    <p class="terms-intro">${escapeHtml(legal.introSubtitle)}</p>
    <h3 class="terms-h3">${escapeHtml(legalSectionHeading(legal.executionTitle))}</h3>
    ${numberedParagraphs(legal.executionItems, 1)}
    <h3 class="terms-h3">${escapeHtml(legalSectionHeading(legal.scheduleTitle))}</h3>
    ${numberedParagraphs(legal.scheduleItems, 7)}
    <h3 class="terms-h3">${escapeHtml(legalSectionHeading(legal.paymentTitle))}</h3>
    <p class="terms-p">${escapeHtml(legal.paymentIntro)}</p>
    <div class="terms-table-block">
      ${termsTableHtml(payHeaders, payRows)}
      <p class="terms-p">${escapeHtml(legal.paymentOptions)}</p>
      <p class="terms-p terms-num">10. ${escapeHtml(legal.paymentRefund)}</p>
    </div>
    <h3 class="terms-h3">${escapeHtml(legalSectionHeading(legal.licensingTitle))}</h3>
    ${numberedParagraphs(legal.licensingItems, 11)}
    <h3 class="terms-h3">${escapeHtml(legalSectionHeading(legal.warrantyTitle))}</h3>
    <div class="terms-table-block">
      ${termsTableHtml(warrantyHeaders, warrantyTableRows)}
    </div>
    <p class="terms-p terms-num">16. ${escapeHtml(legal.warrantyNote)}</p>
    <div class="terms-tail">${escapeHtml(tail)}</div>
    <p class="terms-footer">${escapeHtml(legal.footerLine)}</p>
  </div>`
}

export function renderOfferTermsHtml(
  locale: PdfLocale,
  dict: PdfDict,
  snapshot: OfferTermsSnapshot,
): string {
  if (snapshot.textVersion === OFFER_TERMS_TEXT_VERSION_V2) {
    return renderSimplifiedTermsHtml(locale, dict, snapshot)
  }
  return renderFullLegalTermsHtml(locale, dict, snapshot)
}
