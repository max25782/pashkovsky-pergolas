/**
 * @jest-environment node
 *
 * Company A must not read or change company B projects or articles.
 */
import { NextRequest } from 'next/server'

process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'

const CO_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const CO_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

type Eq = { col: string; val: unknown }

const state = {
  eqs: [] as Eq[],
  inserted: null as Record<string, unknown> | null,
  rowVisible: false,
}

function chain() {
  const eqs: Eq[] = []
  const api: Record<string, unknown> = {
    select: () => api,
    order: () => api,
    eq: (col: string, val: unknown) => {
      eqs.push({ col, val })
      return api
    },
    insert: (row: Record<string, unknown>) => {
      state.inserted = row
      return api
    },
    delete: () => api,
    update: () => api,
    single: async () => ({ data: state.inserted, error: null }),
    maybeSingle: async () => {
      state.eqs = eqs
      const company = eqs.find((e) => e.col === 'company_id')
      if (company?.val !== CO_A || !state.rowVisible) return { data: null, error: null }
      return { data: { id: 'row-a', company_id: CO_A }, error: null }
    },
    then: (
      onfulfilled: (v: unknown) => unknown,
      onrejected?: (e: unknown) => unknown,
    ) => {
      state.eqs = eqs
      const company = eqs.find((e) => e.col === 'company_id')
      const rows = company?.val === CO_A && state.rowVisible ? [{ id: 'row-a', company_id: CO_A }] : []
      return Promise.resolve({ data: rows, error: null }).then(onfulfilled, onrejected)
    },
  }
  return api
}

jest.mock('@/lib/middleware/auth-async', () => ({
  requireAuthAsync: jest.fn(async () => ({
    authorized: true,
    user: { id: 'user-a', email: 'a@example.com' },
    context: { userId: 'user-a', email: 'a@example.com', companyId: CO_A },
  })),
}))

jest.mock('@/lib/s3-upload', () => ({
  isS3Configured: () => false,
  s3Client: null,
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => chain(),
  }),
}))

import { GET as listProjects, DELETE as deleteProject } from '../../../admin-api/pergola-projects/route'
import { GET as publicProjects } from '../../pergola-projects/route'
import { GET as listArticles, DELETE as deleteArticle } from '../../admin/articles/route'

describe('project and article isolation', () => {
  beforeEach(() => {
    state.eqs = []
    state.inserted = null
    state.rowVisible = false
  })

  it('admin project list is limited to the session company', async () => {
    state.rowVisible = true
    const res = await listProjects(new NextRequest('http://localhost/admin-api/pergola-projects'))
    expect(res.status).toBe(200)
    expect(state.eqs).toEqual(expect.arrayContaining([{ col: 'company_id', val: CO_A }]))
  })

  it('admin cannot delete another company project', async () => {
    const res = await deleteProject(
      new NextRequest(`http://localhost/admin-api/pergola-projects?id=${CO_B}`, { method: 'DELETE' }),
    )
    expect(res.status).toBe(404)
    expect(state.eqs).toEqual(expect.arrayContaining([{ col: 'company_id', val: CO_A }]))
  })

  it('public projects require a company id and only published rows', async () => {
    const missing = await publicProjects(new NextRequest('http://localhost/api/pergola-projects'))
    expect(missing.status).toBe(400)

    state.rowVisible = true
    const res = await publicProjects(
      new NextRequest(`http://localhost/api/pergola-projects?company_id=${CO_A}`),
    )
    expect(res.status).toBe(200)
    expect(state.eqs).toEqual(
      expect.arrayContaining([
        { col: 'company_id', val: CO_A },
        { col: 'published', val: true },
      ]),
    )
  })

  it('article list and delete stay inside the session company', async () => {
    state.rowVisible = true
    const list = await listArticles(new NextRequest('http://localhost/api/admin/articles'))
    expect(list.status).toBe(200)
    expect(state.eqs).toEqual(expect.arrayContaining([{ col: 'company_id', val: CO_A }]))

    state.rowVisible = false
    const gone = await deleteArticle(
      new NextRequest('http://localhost/api/admin/articles?slug=other-company', { method: 'DELETE' }),
    )
    expect(gone.status).toBe(404)
    expect(state.eqs).toEqual(expect.arrayContaining([{ col: 'company_id', val: CO_A }]))
  })
})

describe('presign refuses another company key', () => {
  it('rejects a storage key outside the company root', async () => {
    const { assertCompanyStorageKey } = await import('@/lib/gallery/company-scope')
    const blocked = assertCompanyStorageKey(CO_A, `images/${CO_B}/secret.webp`)
    expect('error' in blocked).toBe(true)
    if ('error' in blocked) {
      expect(blocked.error.status).toBe(403)
    }
  })
})
