export const locales = ['he','ru','en'] as const;
export type Locale = typeof locales[number];
export const defaultLocale: Locale = 'he';
export function isRTL(locale: Locale) { return locale === 'he'; }
