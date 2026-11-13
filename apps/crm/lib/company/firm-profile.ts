/**
 * Per-firm contact and branding data.
 *
 * Everything that used to be typed into the code for the first customer (phone, e-mail,
 * site, WhatsApp, VAT id, logo) is read from the firm's own `companies` row instead.
 * A value that the firm did not fill in stays empty: nothing falls back to another firm.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export interface FirmProfile {
  name: string
  phone: string | null
  email: string | null
  website: string | null
  /** Digits only, international format, e.g. "972524494848". Null: the firm has no WhatsApp. */
  whatsappNumber: string | null
  /** Greeting text with `{name}`, `{company}`, `{website}` placeholders. Null: neutral default. */
  whatsappTemplate: string | null
  address: string | null
  city: string | null
  vatNumber: string | null
  logoUrl: string | null
  industry: string | null
  emailSignature: string | null
  pdfFooter: string | null
}

export const EMPTY_FIRM_PROFILE: FirmProfile = {
  name: '',
  phone: null,
  email: null,
  website: null,
  whatsappNumber: null,
  whatsappTemplate: null,
  address: null,
  city: null,
  vatNumber: null,
  logoUrl: null,
  industry: null,
  emailSignature: null,
  pdfFooter: null,
}

/** Country code assumed for numbers typed in national format (leading 0). */
const DEFAULT_COUNTRY_CODE = '972'

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/** Digits-only international number, or null if there is nothing usable. */
export function normalizeWhatsAppNumber(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits === '') return null
  if (digits.startsWith('00')) return digits.slice(2) || null
  if (digits.startsWith('0')) return `${DEFAULT_COUNTRY_CODE}${digits.slice(1)}`
  // Israeli mobile typed without the leading zero (9 digits starting with 5).
  if (digits.length === 9 && digits.startsWith('5')) return `${DEFAULT_COUNTRY_CODE}${digits}`
  return digits
}

export function firmProfileFromRow(row: Record<string, unknown> | null | undefined): FirmProfile {
  if (!row) return EMPTY_FIRM_PROFILE
  return {
    name: clean(row.name) ?? '',
    phone: clean(row.phone) ?? clean(row.primary_phone),
    email: clean(row.primary_email),
    website: clean(row.website),
    whatsappNumber: normalizeWhatsAppNumber(clean(row.whatsapp_number)),
    whatsappTemplate: clean(row.whatsapp_template),
    address: clean(row.address),
    city: clean(row.city),
    vatNumber: clean(row.vat_number),
    logoUrl: clean(row.logo_url),
    industry: clean(row.industry),
    emailSignature: clean(row.email_signature),
    pdfFooter: clean(row.pdf_footer),
  }
}

export async function loadFirmProfile(
  supabase: SupabaseClient,
  companyId: string | null | undefined,
): Promise<FirmProfile> {
  if (!companyId) return EMPTY_FIRM_PROFILE
  try {
    // `*` on purpose: columns added by later migrations are simply absent until applied.
    const { data, error } = await supabase.from('companies').select('*').eq('id', companyId).maybeSingle()
    if (error) {
      console.error('[firm-profile] load failed', { companyId, code: error.code, message: error.message })
      return EMPTY_FIRM_PROFILE
    }
    return firmProfileFromRow(data as Record<string, unknown> | null)
  } catch (error) {
    // A profile problem must not take down offer creation or PDF download; the document then
    // simply carries no firm contact data (never another firm's).
    console.error('[firm-profile] load threw', { companyId, error: error instanceof Error ? error.message : error })
    return EMPTY_FIRM_PROFILE
  }
}

/** The only switch for every WhatsApp button and link in the product. */
export function hasWhatsApp(profile: Pick<FirmProfile, 'whatsappNumber'> | null | undefined): boolean {
  return Boolean(profile?.whatsappNumber)
}

/** `wa.me` link to an arbitrary number (the firm's own, or a customer's). Null when no digits. */
export function whatsAppLinkTo(number: string | null | undefined, text?: string): string | null {
  const digits = normalizeWhatsAppNumber(number)
  if (!digits) return null
  return text ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : `https://wa.me/${digits}`
}

/** Link from the firm to its own WhatsApp (public "write to us" buttons). Null: hide the button. */
export function firmWhatsAppLink(profile: FirmProfile | null | undefined, text?: string): string | null {
  if (!profile || !hasWhatsApp(profile)) return null
  return whatsAppLinkTo(profile.whatsappNumber, text)
}

/**
 * Link for a firm user messaging a customer. A firm without a WhatsApp number gets no link at
 * all, so the whole feature is off for it (product decision "wa_hide").
 */
export function customerWhatsAppLink(
  profile: FirmProfile | null | undefined,
  customerPhone: string | null | undefined,
  text?: string,
): string | null {
  if (!profile || !hasWhatsApp(profile)) return null
  return whatsAppLinkTo(customerPhone, text)
}

/** Neutral greeting used when the firm has not written its own template. */
export const DEFAULT_WHATSAPP_TEMPLATE = 'Hello {name}! This is {company}. How can we help you?'

/**
 * Fills `{name}`, `{company}`, `{website}`. An empty name drops the placeholder with the space
 * before it, so "Hello {name}!" becomes "Hello!" rather than "Hello !".
 */
export function renderMessageTemplate(
  template: string | null | undefined,
  vars: { name?: string | null; company?: string | null; website?: string | null },
): string {
  const source = clean(template) ?? DEFAULT_WHATSAPP_TEMPLATE
  const name = clean(vars.name)
  let out = name ? source.replaceAll('{name}', name) : source.replace(/\s*\{name\}/g, '')
  out = out.replaceAll('{company}', vars.company?.trim() ?? '')
  out = out.replaceAll('{website}', vars.website?.trim() ?? '')
  return out.trim()
}

export function leadGreeting(profile: FirmProfile, leadName?: string | null): string {
  return renderMessageTemplate(profile.whatsappTemplate, {
    name: leadName,
    company: profile.name,
    website: profile.website,
  })
}

/** "Tel. 052-… · office@…" style line; parts the firm did not fill in are left out. */
export function firmContactLine(profile: FirmProfile, phoneLabel: string): string {
  const parts = [profile.phone ? `${phoneLabel} ${profile.phone}` : null, profile.email]
  return parts.filter((part): part is string => Boolean(part)).join(' · ')
}

/** "Name · phone · email" footer used under legal text. */
export function firmFooterLine(profile: FirmProfile, tagline?: string | null): string {
  return [profile.name, clean(tagline), profile.phone, profile.email]
    .filter((part): part is string => Boolean(part))
    .join(' · ')
}

const INDUSTRY_TAGLINES: Record<string, Record<'he' | 'en' | 'ru', string>> = {
  aluminum: { he: 'פתרונות אלומיניום', en: 'aluminum solutions', ru: 'алюминиевые решения' },
}

export function industryTagline(industry: string | null | undefined, locale: 'he' | 'en' | 'ru'): string | null {
  return INDUSTRY_TAGLINES[industry ?? '']?.[locale] ?? null
}

/** Normalised website for display ("www.example.com"), no scheme or trailing slash. */
export function displayWebsite(website: string | null | undefined): string | null {
  const value = clean(website)
  if (!value) return null
  return value.replace(/^https?:\/\//i, '').replace(/\/+$/, '')
}
