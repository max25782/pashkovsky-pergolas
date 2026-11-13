import {
  customerWhatsAppLink,
  displayWebsite,
  firmContactLine,
  firmFooterLine,
  firmProfileFromRow,
  firmWhatsAppLink,
  hasWhatsApp,
  leadGreeting,
  normalizeWhatsAppNumber,
  renderMessageTemplate,
  EMPTY_FIRM_PROFILE,
} from '../firm-profile'
import { pickProfileUpdate } from '../profile-update'

const PASHKOVSKY_ROW = {
  name: 'Pashkovsky Group',
  phone: '052-449-4848',
  primary_email: 'office@pashkovsky-group.com',
  website: 'www.pashkovsky-group.com',
  whatsapp_number: '972524494848',
  whatsapp_template: 'שלום {name}! כאן {company}.',
  vat_number: '320807068',
  industry: 'aluminum',
}
const NEW_FIRM_ROW = { name: 'Roof Masters', industry: 'roofing', phone: null, primary_email: 'a@b.co' }

describe('WhatsApp visibility (wa_hide)', () => {
  it('a firm without a number gets no link of any kind', () => {
    const firm = firmProfileFromRow(NEW_FIRM_ROW)
    expect(hasWhatsApp(firm)).toBe(false)
    expect(firmWhatsAppLink(firm)).toBeNull()
    expect(customerWhatsAppLink(firm, '0501234567', 'hi')).toBeNull()
  })

  it('a blank or non-numeric number counts as no number', () => {
    expect(hasWhatsApp(firmProfileFromRow({ ...NEW_FIRM_ROW, whatsapp_number: '   ' }))).toBe(false)
    expect(hasWhatsApp(firmProfileFromRow({ ...NEW_FIRM_ROW, whatsapp_number: 'abc' }))).toBe(false)
  })

  it('a firm with a number links to its own number', () => {
    const firm = firmProfileFromRow(PASHKOVSKY_ROW)
    expect(firmWhatsAppLink(firm)).toBe('https://wa.me/972524494848')
    expect(firmWhatsAppLink(firm, 'שלום')).toBe(`https://wa.me/972524494848?text=${encodeURIComponent('שלום')}`)
  })

  it('a firm with a number can message a customer; a missing customer phone gives no link', () => {
    const firm = firmProfileFromRow(PASHKOVSKY_ROW)
    expect(customerWhatsAppLink(firm, '050-123-4567', 'x')).toBe('https://wa.me/972501234567?text=x')
    expect(customerWhatsAppLink(firm, '', 'x')).toBeNull()
    expect(customerWhatsAppLink(firm, null, 'x')).toBeNull()
  })

  it('never falls back to another firm: the empty profile has no number', () => {
    expect(hasWhatsApp(EMPTY_FIRM_PROFILE)).toBe(false)
    expect(customerWhatsAppLink(null, '0501234567')).toBeNull()
  })
})

describe('normalizeWhatsAppNumber', () => {
  it.each([
    ['052-449-4848', '972524494848'],
    ['+972 52 449 4848', '972524494848'],
    ['972524494848', '972524494848'],
    ['00972524494848', '972524494848'],
    ['524494848', '972524494848'],
    ['+381641234567', '381641234567'],
  ])('%s -> %s', (raw, digits) => expect(normalizeWhatsAppNumber(raw)).toBe(digits))

  it('empty input is null', () => {
    expect(normalizeWhatsAppNumber('')).toBeNull()
    expect(normalizeWhatsAppNumber(null)).toBeNull()
    expect(normalizeWhatsAppNumber('---')).toBeNull()
  })
})

describe('message template', () => {
  it('fills placeholders', () => {
    expect(renderMessageTemplate('Hi {name}, {company} {website}', { name: 'Dan', company: 'Acme', website: 'a.co' })).toBe(
      'Hi Dan, Acme a.co',
    )
  })

  it('drops the name placeholder together with its space when there is no name', () => {
    expect(renderMessageTemplate('Hello {name}! We are {company}.', { company: 'Acme' })).toBe('Hello! We are Acme.')
    expect(renderMessageTemplate('שלום {name}! כאן {company}.', { name: '  ', company: 'אקמי' })).toBe('שלום! כאן אקמי.')
  })

  it('uses a neutral default that names only the firm itself', () => {
    const text = leadGreeting(firmProfileFromRow(NEW_FIRM_ROW), 'Dan')
    expect(text).toContain('Roof Masters')
    expect(text).not.toMatch(/pashkovsky/i)
  })

  it("the first customer's own template reproduces its old greeting text", () => {
    const firm = firmProfileFromRow(PASHKOVSKY_ROW)
    expect(leadGreeting(firm, 'Dan')).toBe('שלום Dan! כאן Pashkovsky Group.')
    expect(leadGreeting(firm)).toBe('שלום! כאן Pashkovsky Group.')
  })
})

describe('contact lines', () => {
  it('leaves out what the firm did not fill in', () => {
    expect(firmContactLine(firmProfileFromRow(PASHKOVSKY_ROW), 'Tel.')).toBe(
      'Tel. 052-449-4848 · office@pashkovsky-group.com',
    )
    expect(firmContactLine(firmProfileFromRow(NEW_FIRM_ROW), 'Tel.')).toBe('a@b.co')
    expect(firmContactLine(EMPTY_FIRM_PROFILE, 'Tel.')).toBe('')
  })

  it('footer and website display', () => {
    expect(firmFooterLine(firmProfileFromRow(NEW_FIRM_ROW))).toBe('Roof Masters · a@b.co')
    expect(displayWebsite('https://www.x.com/')).toBe('www.x.com')
    expect(displayWebsite('  ')).toBeNull()
  })

  it('phone falls back to primary_phone', () => {
    expect(firmProfileFromRow({ name: 'X', primary_phone: '03-1' }).phone).toBe('03-1')
  })
})

describe('pickProfileUpdate (editor whitelist)', () => {
  it('ignores columns the editor must not write', () => {
    const { update, errors } = pickProfileUpdate({
      name: 'Acme',
      plan: 'enterprise',
      status: 'active',
      trial_ends_at: '2099-01-01',
      id: 'x',
      settings: { a: 1 },
    })
    expect(errors).toEqual([])
    expect(update).toEqual({ name: 'Acme' })
  })

  it('normalises the WhatsApp number and clears it when empty', () => {
    expect(pickProfileUpdate({ whatsapp_number: '052-449-4848' }).update).toEqual({ whatsapp_number: '972524494848' })
    expect(pickProfileUpdate({ whatsapp_number: '' }).update).toEqual({ whatsapp_number: null })
  })

  it('rejects an unusable number, an empty name and a bad color', () => {
    expect(pickProfileUpdate({ whatsapp_number: 'abc' }).errors).toEqual(['whatsapp_number_invalid'])
    expect(pickProfileUpdate({ whatsapp_number: '123' }).errors).toEqual(['whatsapp_number_invalid'])
    expect(pickProfileUpdate({ name: '  ' }).errors).toEqual(['name_required'])
    expect(pickProfileUpdate({ brand_color: 'blue' }).errors).toEqual(['brand_color_invalid'])
    expect(pickProfileUpdate({ brand_color: '#2563EB' }).update).toEqual({ brand_color: '#2563EB' })
  })

  it('blank text becomes null and oversize text is refused', () => {
    expect(pickProfileUpdate({ website: '  ' }).update).toEqual({ website: null })
    expect(pickProfileUpdate({ whatsapp_template: 'x'.repeat(2001) }).errors).toEqual(['field_too_long'])
  })
})
