/**
 * Editable content blocks for the new site (/new): numbers on the stats bar, warranty terms
 * and text reviews. All values here are SAMPLES from the concept and must be replaced by the
 * owner before the site goes live (the UI marks sections as sample while `isSample` is true).
 */
import type { Localized } from './siteTypes'

export interface StatItem {
  value: string
  label: Localized
}

export interface QuoteItem {
  text: Localized
  name: Localized
  meta: string
}

export interface SiteContent {
  isSample: boolean
  stats: StatItem[]
  warranty: {
    period: string
    covered: Localized[]
    notCovered: Localized[]
  }
  quotes: QuoteItem[]
}

const sampleQuote: QuoteItem = {
  text: { he: 'כאן יופיע טקסט אמיתי של לקוח.', en: 'A real client quote goes here.' },
  name: { he: 'שם הלקוח', en: 'Client name' },
  meta: 'city \u00b7 year',
}

export const siteContent: SiteContent = {
  isSample: true,
  stats: [
    { value: '000+', label: { he: 'פרויקטים', en: 'projects' } },
    { value: '00', label: { he: 'שנות ניסיון', en: 'years' } },
    { value: '0000 m\u00b2', label: { he: 'פרגולות שהותקנו', en: 'installed' } },
    { value: '0 yr', label: { he: 'אחריות', en: 'warranty' } },
  ],
  warranty: {
    period: 'X yr',
    covered: [
      { he: 'פגמי ייצור בפרופילים', en: 'Manufacturing defects in profiles' },
      { he: 'ציפוי צבע', en: 'Powder coating' },
      { he: 'מנגנון הלמלות', en: 'Louver mechanism' },
      { he: 'עבודות התקנה', en: 'Installation work' },
    ],
    notCovered: [
      { he: 'נזק מכוון או שימוש לא תקין', en: 'Intentional damage or misuse' },
      { he: 'שינויים ללא אישור', en: 'Unapproved modifications' },
      { he: 'כוח עליון', en: 'Force majeure' },
    ],
  },
  quotes: [sampleQuote, sampleQuote, sampleQuote],
}
