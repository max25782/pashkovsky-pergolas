export const locales = ['he', 'ru', 'en'] as const
export type Locale = typeof locales[number]
export const defaultLocale: Locale = 'he'

export function isRTL(locale: Locale) {
  return locale === 'he'
}

/**
 * Simple inline translation helper — covers the common pattern used across site pages.
 * Returns a function t(he, ru, en) that picks the right string for the given locale.
 *
 * Usage: const t = createTranslator(locale)
 *        t('Hebrew', 'Русский', 'English')
 */
export function createTranslator(locale: Locale) {
  return (he: string, ru: string, en: string): string => {
    if (locale === 'he') return he
    if (locale === 'ru') return ru
    return en
  }
}

