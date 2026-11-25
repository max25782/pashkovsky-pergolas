/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from 'next/server'

process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'

const CO_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const state = {
  authorized: false,
  quotaOk: true,
  uploadedPath: '' as string,
  bucket: '' as string,
}

jest.mock('@/lib/middleware/auth-async', () => ({
  requireAuthAsync: jest.fn(async () => {
    if (!state.authorized) {
      return {
        authorized: false,
        error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      }
    }
    return {
      authorized: true,
      user: { id: 'user-a', email: 'a@example.com' },
      context: { userId: 'user-a', email: 'a@example.com', companyId: CO_A },
    }
  }),
}))

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(async () => ({ allowed: true, remaining: 19, resetAt: Date.now() + 1000 })),
  getClientIp: () => '127.0.0.1',
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: async () => ({
      data: state.quotaOk
        ? { ok: true, used_mb: 1, limit_mb: 100 }
        : { ok: false, error: 'storage_quota_exceeded', used_mb: 100, limit_mb: 100 },
      error: null,
    }),
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string) => {
          state.bucket = bucket
          state.uploadedPath = path
          return { error: null }
        },
        createSignedUrl: async (path: string) => ({
          data: { signedUrl: `https://signed.example/${path}` },
          error: null,
        }),
        remove: async () => ({ error: null }),
      }),
    },
  }),
}))

import { POST } from '../route'

function uploadRequest(file?: File, bucket = 'configurator-photos') {
  const form = new FormData()
  form.set('bucket', bucket)
  if (file) form.set('file', file)
  return new NextRequest('http://localhost/api/configurator/uploads', { method: 'POST', body: form })
}

describe('configurator uploads', () => {
  beforeEach(() => {
    state.authorized = false
    state.quotaOk = true
    state.uploadedPath = ''
    state.bucket = ''
  })

  it('rejects an anonymous upload before writing storage', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' })
    const res = await POST(uploadRequest(file))
    expect(res.status).toBe(401)
    expect(state.uploadedPath).toBe('')
  })

  it('rejects a file type that is not an image', async () => {
    state.authorized = true
    const file = new File([new Uint8Array([1, 2, 3])], 'a.exe', { type: 'application/octet-stream' })
    const res = await POST(uploadRequest(file))
    expect(res.status).toBe(415)
    expect(state.uploadedPath).toBe('')
  })

  it('stores the object under the session company id', async () => {
    state.authorized = true
    const file = new File([new Uint8Array([1, 2, 3, 4])], 'a.png', { type: 'image/png' })
    const res = await POST(uploadRequest(file, 'configurator-results'))
    expect(res.status).toBe(200)
    expect(state.bucket).toBe('configurator-results')
    expect(state.uploadedPath.startsWith(`${CO_A}/configurator-results/`)).toBe(true)
    const body = await res.json()
    expect(body.signedUrl).toContain(state.uploadedPath)
    expect(body.path.startsWith(`${CO_A}/`)).toBe(true)
  })

  it('blocks the upload when the storage quota is exceeded', async () => {
    state.authorized = true
    state.quotaOk = false
    const file = new File([new Uint8Array([1, 2, 3, 4])], 'a.png', { type: 'image/png' })
    const res = await POST(uploadRequest(file))
    expect(res.status).toBe(413)
    expect(state.uploadedPath).toBe('')
    const body = await res.json()
    expect(body.error).toBe('Storage quota exceeded')
  })
})
