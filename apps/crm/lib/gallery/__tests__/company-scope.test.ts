/**
 * @jest-environment node
 */
import {
  assertCompanyStorageKey,
  buildCompanyGalleryStoragePath,
  isUuid,
  parsePublicCompanyId,
  resolveCompanyMediaPrefix,
} from '../company-scope'

const CO_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const CO_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

describe('gallery company-scope helpers', () => {
  it('accepts only uuid company_id for public reads', () => {
    const ok = parsePublicCompanyId(new URLSearchParams({ company_id: CO_A }))
    expect('companyId' in ok && ok.companyId).toBe(CO_A)

    const missing = parsePublicCompanyId(new URLSearchParams())
    expect('error' in missing).toBe(true)

    const bad = parsePublicCompanyId(new URLSearchParams({ company_id: 'not-a-uuid' }))
    expect('error' in bad).toBe(true)
  })

  it('remaps bare images/ to company root and blocks other companies', () => {
    const remapped = resolveCompanyMediaPrefix(CO_A, 'images/')
    expect('prefix' in remapped && remapped.prefix).toBe(`images/${CO_A}/`)

    const nested = resolveCompanyMediaPrefix(CO_A, `images/${CO_A}/pergulot/`)
    expect('prefix' in nested && nested.prefix).toBe(`images/${CO_A}/pergulot/`)

    const leak = resolveCompanyMediaPrefix(CO_A, `images/${CO_B}/`)
    expect('error' in leak).toBe(true)

    const legacyGlobal = resolveCompanyMediaPrefix(CO_A, 'images/pergulot/')
    expect('error' in legacyGlobal).toBe(true)
  })

  it('rejects storage keys outside company root', () => {
    expect(assertCompanyStorageKey(CO_A, `images/${CO_A}/x.webp`).ok).toBe(true)
    expect('error' in assertCompanyStorageKey(CO_A, `images/${CO_B}/x.webp`)).toBe(true)
    expect('error' in assertCompanyStorageKey(CO_A, 'images/pergulot/x.webp')).toBe(true)
  })

  it('builds storage paths with company_id', () => {
    expect(buildCompanyGalleryStoragePath(CO_A, 'pergulot', 'a.webp')).toBe(
      `images/${CO_A}/pergulot/a.webp`,
    )
    expect(buildCompanyGalleryStoragePath(CO_A, 'dgamim', '1.webp', 'atlas')).toBe(
      `images/${CO_A}/dgamim/atlas/1.webp`,
    )
  })

  it('isUuid', () => {
    expect(isUuid(CO_A)).toBe(true)
    expect(isUuid('x')).toBe(false)
  })
})
