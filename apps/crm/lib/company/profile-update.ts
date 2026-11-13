/**
 * Whitelist for the company-profile editor. The PUT used to write the whole request body, which
 * let an admin overwrite columns that are not theirs to edit (plan, status, trial dates).
 */
import { normalizeWhatsAppNumber } from './firm-profile'

export type ProfileUpdateErrorCode =
  | 'name_required'
  | 'whatsapp_number_invalid'
  | 'brand_color_invalid'
  | 'field_too_long'

export interface ProfileUpdateResult {
  update: Record<string, string | null>
  errors: ProfileUpdateErrorCode[]
}

/** Column → maximum length. Only these columns can be changed through the editor. */
const TEXT_FIELDS: Readonly<Record<string, number>> = {
  primary_email: 200,
  phone: 50,
  address: 300,
  city: 120,
  country: 120,
  logo_url: 2000,
  email_signature: 4000,
  pdf_footer: 2000,
  vat_number: 50,
  bank_name: 120,
  bank_account: 80,
  bank_branch: 40,
  website: 300,
  whatsapp_template: 2000,
}

const NAME_MAX = 200
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

export function pickProfileUpdate(body: unknown): ProfileUpdateResult {
  const update: Record<string, string | null> = {}
  const errors: ProfileUpdateErrorCode[] = []
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>

  const text = (value: unknown): string | null | undefined => {
    if (value === undefined) return undefined
    if (value === null) return null
    if (typeof value !== 'string') return undefined
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
  }

  if ('name' in input) {
    const name = text(input.name)
    if (!name) errors.push('name_required')
    else if (name.length > NAME_MAX) errors.push('field_too_long')
    else update.name = name
  }

  for (const [column, max] of Object.entries(TEXT_FIELDS)) {
    if (!(column in input)) continue
    const value = text(input[column])
    if (value === undefined) continue
    if (value !== null && value.length > max) {
      errors.push('field_too_long')
      continue
    }
    update[column] = value
  }

  if ('whatsapp_number' in input) {
    const raw = text(input.whatsapp_number)
    if (raw === null) update.whatsapp_number = null
    else if (raw !== undefined) {
      const digits = normalizeWhatsAppNumber(raw)
      // E.164 allows at most 15 digits; fewer than 8 cannot be a dialable number.
      if (!digits || digits.length < 8 || digits.length > 15) errors.push('whatsapp_number_invalid')
      else update.whatsapp_number = digits
    }
  }

  if ('brand_color' in input) {
    const color = text(input.brand_color)
    if (color === null) update.brand_color = null
    else if (color !== undefined) {
      if (!HEX_COLOR.test(color)) errors.push('brand_color_invalid')
      else update.brand_color = color
    }
  }

  return { update, errors }
}
