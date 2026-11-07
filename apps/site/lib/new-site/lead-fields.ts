import type { Localized } from '@/config/siteTypes'

/**
 * Lead form definition. Used by the form (rendering) and by validation (whitelist of
 * accepted detail fields and select values), so the API never stores arbitrary keys.
 */

export type ServiceId = 'pergola' | 'fence' | 'railing' | 'glass' | 'other'

export interface FieldOption {
  value: string
  label: Localized
}

export interface DetailField {
  name: string
  kind: 'select' | 'number'
  label: Localized
  options?: FieldOption[]
}

export interface ServiceDefinition {
  id: ServiceId
  label: Localized
  fields: DetailField[]
  hint?: Localized
}

const notSure: FieldOption = { value: 'unknown', label: { he: 'עוד לא החלטתי', en: 'Not sure yet' } }

const width: DetailField = { name: 'width_m', kind: 'number', label: { he: 'רוחב (מטר)', en: 'Width (m)' } }
const depth: DetailField = { name: 'depth_m', kind: 'number', label: { he: 'עומק (מטר)', en: 'Depth (m)' } }
const height: DetailField = { name: 'height_m', kind: 'number', label: { he: 'גובה (מטר)', en: 'Height (m)' } }
const length: DetailField = { name: 'length_m', kind: 'number', label: { he: 'אורך כולל (מטר)', en: 'Total length (m)' } }

export const SERVICES: ServiceDefinition[] = [
  {
    id: 'pergola',
    label: { he: 'פרגולה', en: 'Pergola' },
    fields: [
      {
        name: 'pergola_type',
        kind: 'select',
        label: { he: 'סוג פרגולה', en: 'Pergola type' },
        options: [
          { value: 'louvered', label: { he: 'עם למלות מתכווננות', en: 'Louvered' } },
          { value: 'fixed', label: { he: 'קירוי קבוע', en: 'Fixed roof' } },
          { value: 'carport', label: { he: 'קירוי לחניה', en: 'Carport' } },
          notSure,
        ],
      },
      width,
      depth,
      height,
      {
        name: 'attached_to_wall',
        kind: 'select',
        label: { he: 'צמודה לקיר הבית?', en: 'Attached to a house wall?' },
        options: [
          { value: 'unknown', label: { he: 'לא יודע/ת', en: 'Not sure' } },
          { value: 'yes', label: { he: 'כן', en: 'Yes' } },
          { value: 'no', label: { he: 'לא, עומדת בפני עצמה', en: 'No, freestanding' } },
        ],
      },
    ],
    hint: {
      he: 'לא בטוחים במידות? השאירו ריק, נמדוד אצלכם.',
      en: 'Not sure about the size? Leave it empty, we will measure on site.',
    },
  },
  {
    id: 'fence',
    label: { he: 'גדר', en: 'Fence' },
    fields: [
      {
        name: 'fence_type',
        kind: 'select',
        label: { he: 'איזו גדר?', en: 'Which fence?' },
        options: [
          { value: 'slats', label: { he: 'גדר אלומיניום (שלבים)', en: 'Aluminum slat fence' } },
          { value: 'panels', label: { he: 'גדר אלומיניום (פאנלים)', en: 'Aluminum panel fence' } },
          { value: 'glass', label: { he: 'גדר עם זכוכית', en: 'Fence with glass' } },
          notSure,
        ],
      },
      length,
      height,
    ],
  },
  {
    id: 'railing',
    label: { he: 'מעקה', en: 'Railing' },
    fields: [
      {
        name: 'railing_type',
        kind: 'select',
        label: { he: 'סוג מעקה', en: 'Railing type' },
        options: [
          { value: 'aluminum', label: { he: 'אלומיניום', en: 'Aluminum' } },
          { value: 'glass', label: { he: 'זכוכית', en: 'Glass' } },
          { value: 'combined', label: { he: 'אלומיניום וזכוכית', en: 'Aluminum and glass' } },
          notSure,
        ],
      },
      length,
      {
        name: 'location',
        kind: 'select',
        label: { he: 'איפה?', en: 'Where?' },
        options: [
          { value: 'balcony', label: { he: 'מרפסת', en: 'Balcony' } },
          { value: 'stairs', label: { he: 'מדרגות', en: 'Stairs' } },
          { value: 'yard', label: { he: 'חצר', en: 'Yard' } },
          { value: 'other', label: { he: 'אחר', en: 'Other' } },
        ],
      },
    ],
  },
  {
    id: 'glass',
    label: { he: 'זכוכית', en: 'Glass' },
    fields: [
      {
        name: 'glass_type',
        kind: 'select',
        label: { he: 'מה בדיוק?', en: 'What exactly?' },
        options: [
          { value: 'wall', label: { he: 'קיר זכוכית', en: 'Glass wall' } },
          { value: 'sliding', label: { he: 'דלת או חלון הזזה', en: 'Sliding door or window' } },
          { value: 'roof', label: { he: 'קירוי זכוכית', en: 'Glass roof' } },
          { value: 'other', label: { he: 'אחר', en: 'Other' } },
        ],
      },
      width,
      height,
    ],
  },
  {
    id: 'other',
    label: { he: 'אחר', en: 'Other' },
    fields: [],
    hint: {
      he: 'ספרו לנו בקצרה מה אתם צריכים, ונחזור אליכם.',
      en: 'Tell us briefly what you need and we will get back to you.',
    },
  },
]

export function getService(id: ServiceId): ServiceDefinition {
  return SERVICES.find((s) => s.id === id) ?? SERVICES[0]
}

export function isServiceId(value: unknown): value is ServiceId {
  return typeof value === 'string' && SERVICES.some((s) => s.id === value)
}

/** Default value for each select of a service (the first option), as the concept does. */
export function defaultDetails(id: ServiceId): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of getService(id).fields) {
    if (f.kind === 'select' && f.options !== undefined && f.options.length > 0) out[f.name] = f.options[0].value
  }
  return out
}
