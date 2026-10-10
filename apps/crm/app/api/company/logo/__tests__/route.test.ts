const mockGetUser = jest.fn()
const mockMembershipSingle = jest.fn()
const mockUserClientFrom = jest.fn()
const mockAdminFrom = jest.fn()
const mockAdminUpdate = jest.fn()
const mockAdminEq = jest.fn()
const mockS3Send = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      mockUserClientFrom(table)
      if (table !== 'company_members') throw new Error(`user client must not touch ${table}`)
      return { select: () => ({ eq: () => ({ single: mockMembershipSingle }) }) }
    },
  }),
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      mockAdminFrom(table)
      return {
        update: (values: unknown) => {
          mockAdminUpdate(values)
          return {
            eq: (column: string, value: string) => {
              mockAdminEq(column, value)
              return {
                select: () => ({
                  single: () => Promise.resolve({ data: { id: value, logo_url: 'x' }, error: null }),
                }),
              }
            },
          }
        },
      }
    },
  }),
}))

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: mockS3Send })),
  PutObjectCommand: jest.fn((input: unknown) => ({ input })),
}))

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/company/logo/route'

const SESSION_COMPANY = 'company-session'
const OTHER_COMPANY = 'company-other'

function logoRequest(fileName = 'logo.png', extra: Record<string, string> = {}) {
  const form = new FormData()
  form.append('logo', new File([new Uint8Array([1, 2, 3])], fileName, { type: 'image/png' }))
  for (const [key, value] of Object.entries(extra)) form.append(key, value)
  return new NextRequest('http://localhost/api/company/logo', { method: 'POST', body: form })
}

function sessionRole(role: string, permissions: Record<string, boolean> | null = null) {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  mockMembershipSingle.mockResolvedValue({
    data: { company_id: SESSION_COMPANY, role, permissions },
    error: null,
  })
}

describe('POST /api/company/logo', () => {
  const env = { ...process.env }

  beforeEach(() => {
    process.env = {
      ...env,
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
      AWS_S3_BUCKET_NAME: 'bucket',
      AWS_ACCESS_KEY_ID: 'key',
      AWS_SECRET_ACCESS_KEY: 'secret',
    }
    for (const fn of [
      mockGetUser, mockMembershipSingle, mockUserClientFrom, mockAdminFrom,
      mockAdminUpdate, mockAdminEq, mockS3Send,
    ]) fn.mockReset()
    mockS3Send.mockResolvedValue({})
  })

  afterAll(() => {
    process.env = env
  })

  it('401 without a session; nothing is written', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(logoRequest())
    expect(res.status).toBe(401)
    expect(mockAdminFrom).not.toHaveBeenCalled()
    expect(mockS3Send).not.toHaveBeenCalled()
  })

  it('404 when the user has no company', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockMembershipSingle.mockResolvedValue({ data: null, error: { message: 'none' } })
    const res = await POST(logoRequest())
    expect(res.status).toBe(404)
    expect(mockAdminFrom).not.toHaveBeenCalled()
  })

  it.each(['salesperson', 'manager', 'viewer', 'worker'])(
    '403 for role %s, even with permissions.settings (service role stays unused)',
    async (role) => {
      sessionRole(role, { settings: true })
      const res = await POST(logoRequest())
      expect(res.status).toBe(403)
      expect(mockAdminFrom).not.toHaveBeenCalled()
      expect(mockS3Send).not.toHaveBeenCalled()
    },
  )

  it.each(['owner', 'admin'])('200 for %s: service-role update pinned to the session company', async (role) => {
    sessionRole(role)
    const res = await POST(logoRequest())
    expect(res.status).toBe(200)
    expect(mockAdminFrom).toHaveBeenCalledWith('companies')
    expect(mockAdminUpdate).toHaveBeenCalledWith({
      logo_url: expect.stringContaining(`companies/${SESSION_COMPANY}/logo.png`),
    })
    expect(mockAdminEq).toHaveBeenCalledWith('id', SESSION_COMPANY)
    expect(mockUserClientFrom).not.toHaveBeenCalledWith('companies')
  })

  it('ignores a company_id supplied in the request', async () => {
    sessionRole('admin')
    const res = await POST(logoRequest('logo.png', { company_id: OTHER_COMPANY, companyId: OTHER_COMPANY }))
    expect(res.status).toBe(200)
    expect(mockAdminEq).toHaveBeenCalledTimes(1)
    expect(mockAdminEq).toHaveBeenCalledWith('id', SESSION_COMPANY)
    const putInput = (mockS3Send.mock.calls[0][0] as { input: { Key: string } }).input
    expect(putInput.Key.startsWith(`companies/${SESSION_COMPANY}/`)).toBe(true)
    expect(putInput.Key).not.toContain(OTHER_COMPANY)
  })

  it('sanitizes a hostile file extension in the S3 key', async () => {
    sessionRole('owner')
    const res = await POST(logoRequest(`evil.p/../../${OTHER_COMPANY}/x`))
    expect(res.status).toBe(200)
    const putInput = (mockS3Send.mock.calls[0][0] as { input: { Key: string } }).input
    expect(putInput.Key).toBe(`companies/${SESSION_COMPANY}/logo.png`)
  })

  it('500 before any upload when the service role is not configured', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    sessionRole('admin')
    const res = await POST(logoRequest())
    expect(res.status).toBe(500)
    expect(mockS3Send).not.toHaveBeenCalled()
    expect(mockAdminFrom).not.toHaveBeenCalled()
  })
})
