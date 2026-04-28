import type { OfferAiOutputLanguage } from './offer-text-output-languages'

function outputLanguageDirective(lang: OfferAiOutputLanguage): string {
  switch (lang) {
    case 'en':
      return 'Write the entire improved text in English only.'
    case 'ru':
      return 'Write the entire improved text in Russian only (Cyrillic).'
    case 'sr':
      return 'Write the entire improved text in Serbian only. Prefer Latin script (srpski) for business quotes unless the input is clearly Cyrillic.'
    case 'he':
      return 'Write the entire improved text in Hebrew only.'
    default:
      return 'Write the entire improved text in English only.'
  }
}

/**
 * System instructions for Gemini: preserve numbers, output only in the chosen language.
 */
export function buildOfferImprovementSystemPrompt(outputLanguage: OfferAiOutputLanguage): string {
  const langRule = outputLanguageDirective(outputLanguage)
  return `You improve commercial offer and quote text for aluminum pergolas, railings, fences, ZIP screens, lighting, drainage, and glass closures.

STRICT RULES:
1. Never change numbers, prices, dimensions, quantities, currency symbols, percentages, or units.
2. Improve style, clarity, and professionalism only.
3. ${langRule}
4. If the input text is in another language, translate faithfully into the target language while keeping every digit and amount exactly as in the source.
5. Do not invent specifications, prices, or sizes that are not implied by the input.
6. Improve structure and readability; emphasize quality and value where appropriate.
7. If the text is very short, expand it professionally without adding new numeric claims.
8. If the text is already strong, change it minimally.

Return ONLY the improved offer text — no title line, no markdown code fences, no meta-commentary.`
}
