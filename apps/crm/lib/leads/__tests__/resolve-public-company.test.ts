import { hostnameFromUrl, resolvePublicLeadCompany } from '../resolve-public-company'

const COMPANY_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const COMPANY_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const TOKEN = 'site-token-a'

const env = {
  formKeyMap: `other-key:${COMPANY_B}`,
  domainMap: `www.pashkovsky-group.com:${COMPANY_A},pashkovsky-group.com:${COMPANY_A}`,
  legacySiteToken: TOKEN,
  legacyCompanyId: COMPANY_A,
}

describe('resolvePublicLeadCompany', () => {
  it('resolves by form key / site token (legacy CRM_SITE_TOKEN → DEFAULT_COMPANY_ID)', () => {
    expect(resolvePublicLeadCompany({ formKey: TOKEN, env })).toEqual({
      ok: true,
      companyId: COMPANY_A,
      via: 'form_key',
    })
  })

  it('resolves by Origin domain', () => {
    expect(
      resolvePublicLeadCompany({
        origin: 'https://www.pashkovsky-group.com',
        env: { ...env, legacySiteToken: undefined, legacyCompanyId: undefined },
      }),
    ).toEqual({ ok: true, companyId: COMPANY_A, via: 'domain' })
  })

  it('rejects when neither form key nor domain maps to a firm', () => {
    expect(
      resolvePublicLeadCompany({
        formKey: 'unknown',
        origin: 'https://evil.example',
        env,
      }),
    ).toEqual({ ok: false, reason: 'unresolved' })
  })

  it('rejects when form key and domain point at different firms', () => {
    expect(
      resolvePublicLeadCompany({
        formKey: 'other-key',
        origin: 'https://www.pashkovsky-group.com',
        env,
      }),
    ).toEqual({ ok: false, reason: 'conflict' })
  })

  it('rejects a broken env map instead of guessing', () => {
    expect(
      resolvePublicLeadCompany({
        formKey: TOKEN,
        env: { formKeyMap: 'not-a-pair', legacySiteToken: undefined, legacyCompanyId: undefined },
      }),
    ).toEqual({ ok: false, reason: 'invalid_map' })
  })

  it('never returns a company id without a mapping (DEFAULT_COMPANY_ID alone is not enough)', () => {
    expect(
      resolvePublicLeadCompany({
        formKey: null,
        origin: null,
        env: { legacyCompanyId: COMPANY_A },
      }),
    ).toEqual({ ok: false, reason: 'unresolved' })
  })
})

describe('hostnameFromUrl', () => {
  it('reads the host and ignores junk', () => {
    expect(hostnameFromUrl('https://WWW.Example.com/path')).toBe('www.example.com')
    expect(hostnameFromUrl('not a url')).toBeNull()
    expect(hostnameFromUrl(null)).toBeNull()
  })
})
