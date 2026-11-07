import type { Lang } from '@/config/siteTypes'
import { getService, isServiceId, type ServiceId } from './lead-fields'

/** Limits are chosen so the CRM payload (name <= 100, message <= 1000) can never overflow. */
export const LEAD_LIMITS = {
  firstName: 45,
  lastName: 45,
  phone: 20,
  city: 80,
  email: 120,
  message: 600,
  numberMin: 0.3,
  numberMax: 100,
} as const

export type LeadErrorCode = 'required' | 'short' | 'phone' | 'email' | 'number' | 'consent'
/** Keys: firstName, lastName, phone, city, email, consent, and `details.<field>`. */
export type LeadErrors = Record<string, LeadErrorCode>

export interface LeadFormValues {
  firstName: string
  lastName: string
  phone: string
  city: string
  email: string
  message: string
  service: ServiceId
  details: Record<string, string>
  consent: boolean
  website: string
}

export interface LeadPayload {
  first_name: string
  last_name: string
  phone: string
  city: string
  email: string | null
  service: ServiceId
  details: Record<string, string | number>
  message: string | null
  lang: Lang
  page_url: string
  utm: Record<string, string>
  consent: true
  website: string
}

/** Israeli numbers only: returns +972XXXXXXXXX or null. */
export function normalizePhone(value: string): string | null {
  let p = value.replace(/[\s\-().]/g, '')
  if (p.startsWith('+972')) p = `0${p.slice(4)}`
  else if (p.startsWith('972')) p = `0${p.slice(3)}`
  return /^(05\d{8}|0[23489]\d{7}|07\d{8})$/.test(p) ? `+972${p.slice(1)}` : null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function checkName(value: string): LeadErrorCode | null {
  const v = value.trim()
  if (v === '') return 'required'
  return v.length >= 2 ? null : 'short'
}

export function validateLead(values: LeadFormValues): LeadErrors {
  const errors: LeadErrors = {}
  const first = checkName(values.firstName)
  if (first !== null) errors.firstName = first
  const last = checkName(values.lastName)
  if (last !== null) errors.lastName = last
  const city = checkName(values.city)
  if (city !== null) errors.city = city

  if (values.phone.trim() === '') errors.phone = 'required'
  else if (normalizePhone(values.phone) === null) errors.phone = 'phone'

  const email = values.email.trim()
  if (email !== '' && !EMAIL_RE.test(email)) errors.email = 'email'
  if (!values.consent) errors.consent = 'consent'

  for (const field of getService(values.service).fields) {
    if (field.kind !== 'number') continue
    const raw = (values.details[field.name] ?? '').trim()
    if (raw === '') continue
    const n = Number.parseFloat(raw)
    if (!(n >= LEAD_LIMITS.numberMin && n <= LEAD_LIMITS.numberMax)) errors[`details.${field.name}`] = 'number'
  }
  return errors
}

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const

/** Build the payload sent to /api/leads from validated form values. */
export function buildLeadPayload(
  values: LeadFormValues,
  context: { lang: Lang; pageUrl: string; search: string },
): LeadPayload {
  const details: Record<string, string | number> = {}
  for (const field of getService(values.service).fields) {
    const raw = (values.details[field.name] ?? '').trim()
    if (raw === '') continue
    details[field.name] = field.kind === 'number' ? Number.parseFloat(raw) : raw
  }
  const query = new URLSearchParams(context.search)
  const utm: Record<string, string> = {}
  for (const key of UTM_KEYS) {
    const v = query.get(key)
    if (v !== null && v !== '') utm[key] = v.slice(0, 100)
  }
  const phone = normalizePhone(values.phone)
  if (phone === null) throw new Error('buildLeadPayload called with an invalid phone')
  const email = values.email.trim()
  const message = values.message.trim()
  return {
    first_name: values.firstName.trim(),
    last_name: values.lastName.trim(),
    phone,
    city: values.city.trim(),
    email: email === '' ? null : email,
    service: values.service,
    details,
    message: message === '' ? null : message,
    lang: context.lang,
    page_url: context.pageUrl.split('#')[0],
    utm,
    consent: true,
    website: values.website,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

/**
 * Server-side re-validation of an untrusted body. Returns the cleaned payload or the errors.
 * Detail keys are limited to the fields of the chosen service (no arbitrary metadata).
 */
export function parseLeadPayload(
  body: unknown,
): { ok: true; payload: LeadPayload } | { ok: false; errors: LeadErrors } {
  if (!isRecord(body)) return { ok: false, errors: { body: 'required' } }
  const service: ServiceId = isServiceId(body.service) ? body.service : 'other'
  const rawDetails = isRecord(body.details) ? body.details : {}
  const details: Record<string, string> = {}
  for (const field of getService(service).fields) {
    const v = rawDetails[field.name]
    if (typeof v === 'string' || typeof v === 'number') details[field.name] = String(v)
  }
  const values: LeadFormValues = {
    firstName: str(body.first_name, LEAD_LIMITS.firstName),
    lastName: str(body.last_name, LEAD_LIMITS.lastName),
    phone: str(body.phone, LEAD_LIMITS.phone),
    city: str(body.city, LEAD_LIMITS.city),
    email: str(body.email, LEAD_LIMITS.email),
    message: str(body.message, LEAD_LIMITS.message),
    service,
    details,
    consent: body.consent === true,
    website: str(body.website, 200),
  }
  const errors = validateLead(values)
  if (Object.keys(errors).length > 0) return { ok: false, errors }
  const lang: Lang = body.lang === 'en' ? 'en' : 'he'
  const query = new URLSearchParams()
  if (isRecord(body.utm)) {
    for (const key of UTM_KEYS) {
      const v = body.utm[key]
      if (typeof v === 'string') query.set(key, v)
    }
  }
  const payload = buildLeadPayload(values, {
    lang,
    pageUrl: str(body.page_url, 300),
    search: query.toString(),
  })
  return { ok: true, payload }
}

export interface CrmLeadBody {
  name: string
  phone: string
  email: string
  message: string
  source: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  website: string
  metadata: Record<string, unknown>
}

/** Map to the existing CRM endpoint (POST /api/public/leads). */
export function toCrmPayload(payload: LeadPayload): CrmLeadBody {
  const summary = [
    `service: ${payload.service}`,
    `city: ${payload.city}`,
    ...Object.entries(payload.details).map(([k, v]) => `${k}: ${v}`),
  ].join(' | ')
  return {
    name: `${payload.first_name} ${payload.last_name}`.trim(),
    phone: payload.phone,
    email: payload.email ?? '',
    message: payload.message === null ? summary : `${summary}\n${payload.message}`,
    source: 'new-site',
    utm_source: payload.utm.utm_source,
    utm_medium: payload.utm.utm_medium,
    utm_campaign: payload.utm.utm_campaign,
    website: payload.website,
    metadata: {
      city: payload.city,
      service: payload.service,
      details: payload.details,
      lang: payload.lang,
      page_url: payload.page_url,
      utm: payload.utm,
      consent: payload.consent,
    },
  }
}
