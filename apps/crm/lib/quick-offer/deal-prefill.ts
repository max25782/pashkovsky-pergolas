/**
 * Link between a deal (or lead) and the Quick Offer page.
 * Same mechanism as the lead row in TodayQueue: query string on /app/quick-offer.
 * `dealId` binds the new offer to that deal; the other fields prefill the form.
 */
import { normalizeCustomerNameInput } from './validate-customer-name'

export const QUICK_OFFER_PATH = '/app/quick-offer'

export interface QuickOfferPrefill {
  dealId: string
  name: string
  phone: string
  city: string
}

const DEAL_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

export function buildQuickOfferHref(prefill: Partial<QuickOfferPrefill>): string {
  const qs = new URLSearchParams()
  const set = (key: string, value: string | undefined) => {
    const v = value?.trim()
    if (v) qs.set(key, v)
  }
  set('dealId', prefill.dealId)
  set('name', prefill.name)
  set('phone', prefill.phone)
  set('city', prefill.city)
  const query = qs.toString()
  return query ? `${QUICK_OFFER_PATH}?${query}` : QUICK_OFFER_PATH
}

/**
 * Deal phones are often stored as pasted from WhatsApp/Contacts: wrapped in bidi
 * control marks with non-breaking spaces and U+2011 hyphens. Normalise them so the
 * offer form gets a plain, editable number.
 */
function cleanPhonePrefill(raw: string): string {
  return raw
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\u2011/g, '-')
    .replace(/\u00a0/g, ' ')
    .trim()
}

/** Returns null when the URL carries nothing to prefill (a plain "new offer" visit). */
export function parseQuickOfferPrefill(search: string | URLSearchParams): QuickOfferPrefill | null {
  const qs = typeof search === 'string' ? new URLSearchParams(search) : search
  const rawDealId = (qs.get('dealId') ?? '').trim()
  const dealId = DEAL_ID_PATTERN.test(rawDealId) ? rawDealId : ''
  const name = normalizeCustomerNameInput(qs.get('name') ?? '')
  const phone = cleanPhonePrefill(qs.get('phone') ?? '')
  const city = (qs.get('city') ?? '').trim()
  if (!dealId && !name && !phone && !city) return null
  return { dealId, name, phone, city }
}
