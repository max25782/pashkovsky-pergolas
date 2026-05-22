export type PdfLocale = 'he' | 'ru' | 'en' | 'sr'

export function resolvePdfLocale(raw: string | null | undefined): PdfLocale {
  const s = (raw ?? 'he').trim().toLowerCase()
  if (s === 'ru' || s.startsWith('ru')) return 'ru'
  if (s === 'en' || s.startsWith('en')) return 'en'
  if (s === 'sr' || s === 'rs' || s.startsWith('sr')) return 'sr'
  return 'he'
}

export function pdfHtmlDir(locale: PdfLocale): 'rtl' | 'ltr' {
  return locale === 'he' || locale === 'ru' ? 'rtl' : 'ltr'
}

export function pdfBcp47Locale(locale: PdfLocale): string {
  const map: Record<PdfLocale, string> = {
    he: 'he-IL',
    ru: 'ru-RU',
    en: 'en-IL',
    sr: 'sr-Latn-RS',
  }
  return map[locale]
}

export function pdfCurrencySymbol(locale: PdfLocale): string {
  const map: Record<PdfLocale, string> = {
    he: '₪',
    ru: '₽',
    en: '$',
    sr: 'RSD',
  }
  return map[locale]
}
