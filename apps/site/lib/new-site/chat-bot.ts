import type { Lang, Localized } from '@/config/siteTypes'
import { whatsappUrl } from '@/config/siteContact'

/**
 * Local keyword bot used by the /new demo chat. It never calls a network or the CRM
 * (the real AI chat stores history in Supabase, which Preview must not touch).
 */

export interface BotReply {
  text: string
  /** In-page anchor, e.g. '#calc'. */
  go?: string
  /** External link, opened in a new tab. */
  href?: string
  label?: string
}

interface KbEntry {
  pattern: RegExp
  text: Localized
  go?: string
  label?: Localized
}

const KB: KbEntry[] = [
  {
    pattern: /אחריות|warrant/i,
    go: '#warranty',
    text: {
      he: 'פרטי האחריות מופיעים באתר: תקופה, מה מכוסה ומה לא. נציג יאשר לכם את התנאים המדויקים.',
      en: 'The warranty details are on the site: period, what is covered and what is not. A representative will confirm the exact terms.',
    },
    label: { he: 'לאחריות', en: 'To the warranty' },
  },
  {
    pattern: /מחיר|עלות|כמה עולה|price|cost|quote/i,
    go: '#calc',
    text: {
      he: 'אפשר לקבל הערכה ראשונית במחשבון באתר. המחיר הסופי נקבע אחרי מדידה.',
      en: 'You can get a first estimate in the calculator. The final price is set after measuring.',
    },
    label: { he: 'למחשבון', en: 'To the calculator' },
  },
  {
    pattern: /מדיד|תהליך|measure|process|start/i,
    go: '#process',
    text: {
      he: 'מגיעים למקום, מודדים, מכינים שרטוט והצעה, מייצרים ומתקינים.',
      en: 'We visit, measure, prepare a drawing and quote, then fabricate and install.',
    },
    label: { he: 'לתהליך', en: 'To the process' },
  },
  {
    pattern: /זמן|מתי|כמה זמן|long|when|time/i,
    text: {
      he: 'משך הזמן תלוי בגודל ובדגם. נציג יחזור אליכם עם לוח זמנים.',
      en: 'The timeline depends on size and model. A representative will come back with a schedule.',
    },
  },
  {
    pattern: /למל|louver|shade|צל/i,
    go: '#models',
    text: {
      he: 'למלות מתכווננות מאפשרות לשלוט באור ובצל, ולסגור לגמרי כשיורד גשם.',
      en: 'Adjustable louvers let you control light and shade, and close fully when it rains.',
    },
    label: { he: 'לדגמים', en: 'To the models' },
  },
  {
    pattern: /טלפון|phone|call|whatsapp|וואטסאפ|contact/i,
    text: {
      he: 'הכי מהר לכתוב לנו בוואטסאפ, או להשאיר פרטים ונחזור אליכם.',
      en: 'The fastest way is WhatsApp, or leave your details and we will call back.',
    },
  },
]

const FALLBACK: Localized = {
  he: 'אני כרגע הדגמה בלבד. באתר האמיתי תענה כאן בינה מלאכותית. בינתיים אפשר לכתוב לנו בוואטסאפ.',
  en: 'I am a demo for now. On the live site an AI model will answer here. Meanwhile you can write to us on WhatsApp.',
}

export function matchReply(input: string, lang: Lang): BotReply {
  for (const entry of KB) {
    if (entry.pattern.test(input)) {
      return {
        text: entry.text[lang],
        go: entry.go,
        label: entry.label?.[lang],
      }
    }
  }
  return { text: FALLBACK[lang], href: whatsappUrl(), label: 'WhatsApp' }
}

export const SUGGESTIONS: Record<Lang, string[]> = {
  he: ['כמה עולה פרגולה?', 'מה האחריות?', 'איך מתחיל התהליך?'],
  en: ['How much is a pergola?', 'What is the warranty?', 'How does it start?'],
}
