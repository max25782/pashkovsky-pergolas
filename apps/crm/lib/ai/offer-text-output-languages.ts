/** Languages supported for AI-generated / improved offer notes (Quick Offer, etc.). */
export const OFFER_AI_OUTPUT_LANGUAGES = ['en', 'ru', 'sr', 'he'] as const
export type OfferAiOutputLanguage = (typeof OFFER_AI_OUTPUT_LANGUAGES)[number]

export function parseOfferAiOutputLanguage(raw: unknown): OfferAiOutputLanguage {
  if (typeof raw !== 'string') return 'he'
  const s = raw.trim().toLowerCase()
  if (s === 'en' || s.startsWith('en')) return 'en'
  if (s === 'ru' || s.startsWith('ru')) return 'ru'
  if (s === 'sr' || s === 'rs' || s.startsWith('sr')) return 'sr'
  if (s === 'he' || s.startsWith('he')) return 'he'
  return 'he'
}
