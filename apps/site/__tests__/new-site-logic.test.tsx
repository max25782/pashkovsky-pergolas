import { calculatorConfig, type CalculatorConfig } from '@/config/siteCalculator'
import { calculate, formatPriceRange } from '@/lib/new-site/calc'
import { matchReply } from '@/lib/new-site/chat-bot'
import { canSendRealLeads, isLeadDemo } from '@/lib/new-site/lead-mode'
import {
  buildLeadPayload,
  LEAD_LIMITS,
  normalizePhone,
  parseLeadPayload,
  toCrmPayload,
  validateLead,
  type LeadFormValues,
} from '@/lib/new-site/lead-schema'
import { mediaUrl, placeholderGradient } from '@/lib/new-site/media-url'

const validValues: LeadFormValues = {
  firstName: 'Dan',
  lastName: 'Levi',
  phone: '052-449-4848',
  city: 'Haifa',
  email: '',
  message: '',
  service: 'pergola',
  details: { pergola_type: 'louvered', width_m: '6' },
  consent: true,
  website: '',
}

describe('calculator', () => {
  it('computes area, posts, louvers, span and a rounded price range from the config', () => {
    const result = calculate({ type: 'louvered', width: 6, depth: 4 })
    expect(result.area).toBe(24)
    expect(result.posts).toBe(6)
    expect(result.louvers).toBe(44)
    expect(result.maxSpan).toBe(4)
    expect(result.priceMin).toBe(52800)
    expect(result.priceMax).toBe(76800)
  })

  it('has no louvers for roofs without them', () => {
    expect(calculate({ type: 'fixed', width: 6, depth: 4 }).louvers).toBeNull()
  })

  it('takes every price from the passed config (nothing is hardcoded)', () => {
    const custom: CalculatorConfig = {
      ...calculatorConfig,
      priceRoundTo: 10,
      types: [{ id: 'louvered', label: { he: 'x', en: 'x' }, hasLouvers: true, ratePerM2: { min: 1000, max: 2000 } }],
    }
    const result = calculate({ type: 'louvered', width: 6, depth: 4 }, custom)
    expect(result.priceMin).toBe(24000)
    expect(result.priceMax).toBe(48000)
  })

  it('formats the range with the configured currency', () => {
    const text = formatPriceRange(calculate({ type: 'louvered', width: 6, depth: 4 }))
    expect(text).toBe('52,800 \u2013 76,800 \u20aa')
  })
})

describe('lead mode (fail closed)', () => {
  it('is demo unless the flag is exactly "false"', () => {
    expect(isLeadDemo(undefined)).toBe(true)
    expect(isLeadDemo('true')).toBe(true)
    expect(isLeadDemo('')).toBe(true)
    expect(isLeadDemo('false')).toBe(false)
  })

  it('sends for real only with all three conditions', () => {
    const all = { demoFlag: 'false', realEnabled: 'true', vercelEnv: 'production' }
    expect(canSendRealLeads(all)).toBe(true)
    expect(canSendRealLeads({ ...all, vercelEnv: 'preview' })).toBe(false)
    expect(canSendRealLeads({ ...all, vercelEnv: undefined })).toBe(false)
    expect(canSendRealLeads({ ...all, realEnabled: undefined })).toBe(false)
    expect(canSendRealLeads({ ...all, demoFlag: 'true' })).toBe(false)
    expect(canSendRealLeads({ ...all, demoFlag: undefined })).toBe(false)
  })
})

describe('lead validation', () => {
  it('normalizes Israeli phone numbers', () => {
    expect(normalizePhone('052-449-4848')).toBe('+972524494848')
    expect(normalizePhone('+972 52 449 4848')).toBe('+972524494848')
    expect(normalizePhone('04-123-4567')).toBe('+97241234567')
    expect(normalizePhone('12345')).toBeNull()
    expect(normalizePhone('+1 202 555 0100')).toBeNull()
  })

  it('accepts a complete form', () => {
    expect(validateLead(validValues)).toEqual({})
  })

  it('reports every required field of an empty form', () => {
    const errors = validateLead({ ...validValues, firstName: '', lastName: '', phone: '', city: '', consent: false })
    expect(errors).toEqual({
      firstName: 'required',
      lastName: 'required',
      phone: 'required',
      city: 'required',
      consent: 'consent',
    })
  })

  it('rejects a bad e-mail, a bad phone and out-of-range sizes, but allows an empty e-mail', () => {
    const errors = validateLead({ ...validValues, email: 'nope', phone: '123', details: { width_m: '500' } })
    expect(errors.email).toBe('email')
    expect(errors.phone).toBe('phone')
    expect(errors['details.width_m']).toBe('number')
    expect(validateLead({ ...validValues, email: '' }).email).toBeUndefined()
  })

  it('builds a payload with a normalized phone, numeric sizes and utm data', () => {
    const payload = buildLeadPayload(validValues, {
      lang: 'en',
      pageUrl: 'https://example.com/new#contact',
      search: '?utm_source=google&utm_medium=cpc&other=1',
    })
    expect(payload.phone).toBe('+972524494848')
    expect(payload.details).toEqual({ pergola_type: 'louvered', width_m: 6 })
    expect(payload.page_url).toBe('https://example.com/new')
    expect(payload.utm).toEqual({ utm_source: 'google', utm_medium: 'cpc' })
    expect(payload.email).toBeNull()
  })

  it('never overflows the CRM limits (name 100, message 1000), even at the maximum input', () => {
    const long = 'x'.repeat(2000)
    const parsed = parseLeadPayload({
      first_name: long,
      last_name: long,
      phone: '0524494848',
      city: long,
      service: 'pergola',
      details: { pergola_type: 'louvered', width_m: 99, depth_m: 99, height_m: 99 },
      message: long,
      consent: true,
    })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const crm = toCrmPayload(parsed.payload)
    expect(crm.name.length).toBeLessThanOrEqual(100)
    expect(crm.message.length).toBeLessThanOrEqual(1000)
    expect(parsed.payload.message?.length).toBe(LEAD_LIMITS.message)
    expect(crm.source).toBe('new-site')
  })
})

describe('server-side parsing of an untrusted body', () => {
  const base = {
    first_name: 'Dan',
    last_name: 'Levi',
    phone: '0524494848',
    city: 'Haifa',
    service: 'pergola',
    consent: true,
  }

  it('drops detail keys that are not fields of the chosen service', () => {
    const parsed = parseLeadPayload({ ...base, details: { width_m: 6, evil_key: 'x', fence_type: 'slats' } })
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.payload.details).toEqual({ width_m: 6 })
  })

  it('rejects non-object bodies and missing consent', () => {
    expect(parseLeadPayload(null).ok).toBe(false)
    expect(parseLeadPayload('text').ok).toBe(false)
    const noConsent = parseLeadPayload({ ...base, consent: 'yes' })
    expect(noConsent.ok).toBe(false)
  })

  it('falls back to the "other" service for an unknown service id', () => {
    const parsed = parseLeadPayload({ ...base, service: 'rockets', details: { width_m: 6 } })
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.payload.service).toBe('other')
      expect(parsed.payload.details).toEqual({})
    }
  })
})

describe('media urls', () => {
  const original = process.env.NEXT_PUBLIC_MEDIA_BASE_URL

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_MEDIA_BASE_URL
    else process.env.NEXT_PUBLIC_MEDIA_BASE_URL = original
  })

  it('returns null for an empty slot', () => {
    expect(mediaUrl('')).toBeNull()
    expect(mediaUrl('   ')).toBeNull()
    expect(mediaUrl(undefined)).toBeNull()
  })

  it('keeps absolute URLs untouched', () => {
    expect(mediaUrl('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg')
  })

  it('resolves keys against NEXT_PUBLIC_MEDIA_BASE_URL and encodes unsafe characters', () => {
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL = 'https://d111.cloudfront.net/'
    expect(mediaUrl('new-site/hero/hero.mp4')).toBe('https://d111.cloudfront.net/new-site/hero/hero.mp4')
    expect(mediaUrl('new-site/my photo.jpg')).toBe('https://d111.cloudfront.net/new-site/my%20photo.jpg')
  })

  it('paints a placeholder gradient from the hue, with a fallback for bad input', () => {
    expect(placeholderGradient('200,60%,40%')).toContain('hsl(200, 60%, 40%)')
    expect(placeholderGradient('garbage')).toContain('linear-gradient')
  })
})

describe('demo chat bot', () => {
  it('answers from the keyword base and points to a section', () => {
    expect(matchReply('מה האחריות?', 'he').go).toBe('#warranty')
    expect(matchReply('How much does it cost?', 'en').go).toBe('#calc')
  })

  it('falls back to WhatsApp for unknown questions', () => {
    const reply = matchReply('zzz qqq', 'en')
    expect(reply.href).toContain('wa.me')
    expect(reply.text.length).toBeGreaterThan(0)
  })
})
