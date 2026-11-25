/**
 * @jest-environment node
 *
 * Company A must not read or mutate company B gallery rows via admin-api.
 */
process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'

const CO_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const CO_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const IMG_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0001'
const CAT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0002'

type EqFilter = { col: string; val: unknown }

const state = {
  callerCompanyId: CO_A as string,
  lastImagesSelectEq: [] as EqFilter[],
  lastImagesDeleteEq: [] as EqFilter[],
  lastCategoriesSelectEq: [] as EqFilter[],
  lastCategoriesDeleteEq: [] as EqFilter[],
  imagesSelectResult: [] as Record<string, unknown>[],
  imageFetchResult: null as Record<string, unknown> | null,
  categoryDeleteResult: null as Record<string, unknown> | null,
}

jest.mock('@/lib/middleware/auth-async', () => ({
  requireAuthAsync: jest.fn(async () => ({
    authorized: true,
    user: { id: 'user-a', email: 'a@example.com' },
    context: { userId: 'user-a', email: 'a@example.com', companyId: state.callerCompanyId },
  })),
}))

jest.mock('@/lib/supabase-admin-url', () => ({
  getSupabaseUrlForServiceRole: () => process.env.SUPABASE_URL,
}))

jest.mock('@/lib/s3-upload', () => ({
  deleteFromS3: jest.fn(async () => undefined),
  isS3Configured: () => false,
}))

function makeChain(kind: 'images-select' | 'images-delete' | 'images-fetch' | 'categories-select' | 'categories-delete') {
  const eqs: EqFilter[] = []
  const chain: Record<string, unknown> = {
    select: jest.fn(() => chain),
    order: jest.fn(() => chain),
    eq: jest.fn((col: string, val: unknown) => {
      eqs.push({ col, val })
      return chain
    }),
    delete: jest.fn(() => chain),
    update: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    single: jest.fn(async () => ({ data: null, error: null })),
    maybeSingle: jest.fn(async () => {
      if (kind === 'images-fetch') {
        const companyEq = eqs.find((e) => e.col === 'company_id')
        if (companyEq?.val !== CO_A) return { data: null, error: null }
        return { data: state.imageFetchResult, error: null }
      }
      if (kind === 'categories-delete') {
        const companyEq = eqs.find((e) => e.col === 'company_id')
        if (companyEq?.val !== CO_A) return { data: null, error: null }
        return { data: state.categoryDeleteResult, error: null }
      }
      return { data: null, error: null }
    }),
    then: undefined as unknown,
  }

  // Make thenable for await of select/order chains
  ;(chain as { then: typeof Promise.prototype.then }).then = (
    onfulfilled: (v: unknown) => unknown,
    onrejected?: (e: unknown) => unknown,
  ) => {
    if (kind === 'images-select') {
      state.lastImagesSelectEq = [...eqs]
      return Promise.resolve({ data: state.imagesSelectResult, error: null }).then(onfulfilled, onrejected)
    }
    if (kind === 'categories-select') {
      state.lastCategoriesSelectEq = [...eqs]
      return Promise.resolve({ data: [], error: null }).then(onfulfilled, onrejected)
    }
    if (kind === 'images-delete') {
      state.lastImagesDeleteEq = [...eqs]
      return Promise.resolve({ data: null, error: null }).then(onfulfilled, onrejected)
    }
    if (kind === 'categories-delete') {
      state.lastCategoriesDeleteEq = [...eqs]
      return Promise.resolve({ data: null, error: null }).then(onfulfilled, onrejected)
    }
    return Promise.resolve({ data: null, error: null }).then(onfulfilled, onrejected)
  }

  return { chain, eqs }
}

let imagesSelectChain = makeChain('images-select')
let imagesFetchChain = makeChain('images-fetch')
let imagesDeleteChain = makeChain('images-delete')
let categoriesSelectChain = makeChain('categories-select')
let categoriesDeleteChain = makeChain('categories-delete')

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from(table: string) {
      if (table === 'gallery_images') {
        return {
          select: (cols: string) => {
            if (cols === 'storage_path, url' || cols === 'storage_path, url, size') {
              imagesFetchChain = makeChain('images-fetch')
              return imagesFetchChain.chain
            }
            imagesSelectChain = makeChain('images-select')
            return imagesSelectChain.chain
          },
          delete: () => {
            imagesDeleteChain = makeChain('images-delete')
            return imagesDeleteChain.chain
          },
        }
      }
      if (table === 'gallery_categories') {
        return {
          select: () => {
            categoriesSelectChain = makeChain('categories-select')
            return categoriesSelectChain.chain
          },
          delete: () => {
            categoriesDeleteChain = makeChain('categories-delete')
            return categoriesDeleteChain.chain
          },
          insert: () => categoriesSelectChain.chain,
          update: () => categoriesSelectChain.chain,
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  })),
}))

import { NextRequest } from 'next/server'
import { GET as getImages, DELETE as deleteImage } from '../images/route'
import { GET as getCategories, DELETE as deleteCategory } from '../categories/route'
import { GET as getPublicImages } from '../../../api/gallery/images/route'

describe('gallery company isolation', () => {
  beforeEach(() => {
    state.callerCompanyId = CO_A
    state.imagesSelectResult = [
      { id: 'img-a', company_id: CO_A, category_key: 'pergulot' },
    ]
    state.imageFetchResult = null
    state.categoryDeleteResult = null
    state.lastImagesSelectEq = []
    state.lastImagesDeleteEq = []
    state.lastCategoriesSelectEq = []
    state.lastCategoriesDeleteEq = []
  })

  it('admin list images always filters by caller company_id', async () => {
    const res = await getImages(
      new NextRequest(`http://localhost/admin-api/gallery/images?category_key=pergulot`),
    )
    expect(res.status).toBe(200)
    expect(state.lastImagesSelectEq).toEqual(
      expect.arrayContaining([
        { col: 'company_id', val: CO_A },
        { col: 'category_key', val: 'pergulot' },
      ]),
    )
    const body = await res.json()
    expect(body.images).toHaveLength(1)
    expect(body.images[0].company_id).toBe(CO_A)
  })

  it('admin cannot delete company B image by id', async () => {
    // Row for IMG_B is not visible under company A filter → maybeSingle null → 404
    state.imageFetchResult = null
    const res = await deleteImage(
      new NextRequest(`http://localhost/admin-api/gallery/images?id=${IMG_B}`, { method: 'DELETE' }),
    )
    expect(res.status).toBe(404)
    expect(state.lastImagesDeleteEq).toEqual([])
  })

  it('admin categories list filters by company_id', async () => {
    const res = await getCategories(new NextRequest('http://localhost/admin-api/gallery/categories'))
    expect(res.status).toBe(200)
    expect(state.lastCategoriesSelectEq).toEqual(
      expect.arrayContaining([{ col: 'company_id', val: CO_A }]),
    )
  })

  it('admin cannot delete company B category', async () => {
    state.categoryDeleteResult = null
    const res = await deleteCategory(
      new NextRequest(`http://localhost/admin-api/gallery/categories?id=${CAT_B}`, { method: 'DELETE' }),
    )
    expect(res.status).toBe(404)
  })

  it('public gallery rejects missing company_id and accepts scoped read', async () => {
    const missing = await getPublicImages(new NextRequest('http://localhost/api/gallery/images'))
    expect(missing.status).toBe(400)

    state.imagesSelectResult = [
      { url: 'https://cdn.example/a.webp', filename: 'a.webp', category_key: 'pergulot' },
    ]
    const ok = await getPublicImages(
      new NextRequest(`http://localhost/api/gallery/images?company_id=${CO_A}&category_key=pergulot`),
    )
    expect(ok.status).toBe(200)
    const body = await ok.json()
    expect(body.images).toEqual(['https://cdn.example/a.webp'])
  })

  it('media prefix helper blocks cross-company listing (direct)', async () => {
    const { resolveCompanyMediaPrefix } = await import('@/lib/gallery/company-scope')
    const blocked = resolveCompanyMediaPrefix(CO_A, `images/${CO_B}/`)
    expect('error' in blocked).toBe(true)
  })
})
