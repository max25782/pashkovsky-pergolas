export const locales = ['he','ru','en'] as const;
export type Locale = typeof locales[number];
export const defaultLocale: Locale = 'en';
export function isRTL(locale: Locale) { return locale === 'he'; }
