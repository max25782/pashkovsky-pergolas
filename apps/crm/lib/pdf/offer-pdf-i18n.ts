import type { PdfLocale } from './pdf-locale'
import { resolvePdfLocale, pdfHtmlDir, pdfBcp47Locale } from './pdf-locale'

export type { PdfLocale } from './pdf-locale'
export { resolvePdfLocale, pdfHtmlDir, pdfBcp47Locale } from './pdf-locale'

import raw from './pdf-translations.json'

export type PdfDict = (typeof raw)['he']

export const pdfT: Record<PdfLocale, PdfDict> = {
  he: raw.he,
  en: raw.en,
  ru: raw.ru,
  sr: raw.sr,
}
