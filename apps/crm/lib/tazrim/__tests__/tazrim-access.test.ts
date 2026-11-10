const mockRedirect = jest.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`)
})
jest.mock('next/navigation', () => ({ redirect: (url: string) => mockRedirect(url) }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

interface FakeSession {
  user: { id: string } | null
  membership: { company_id: string; role: string } | null
}

const mockFrom = jest.fn()
let session: FakeSession = { user: null, membership: null }

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: session.user }, error: null }),
    },
    from: (table: string) => {
      mockFrom(table)
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: session.membership, error: null }),
        insert: async () => ({ error: null }),
        delete: () => chain,
      }
      return chain
    },
  }),
}))

import { canAccessTazrim, PASHKOVSKY_COMPANY_ID } from '../access'
import {
  getTazrimContext,
  requireTazrimAccess,
  requireTazrimActionContext,
  TazrimForbiddenError,
} from '../guard'
import { canAccessNavPath, isValidRole, type Role } from '@/lib/permissions'
import { addVendor, deleteVendor } from '@/app/app/admin/tazrim/actions'
import { approvePayrollExpense, syncAluminCRM } from '@/app/app/admin/tazrim/crm/actions'

const OTHER_COMPANY_ID = '11111111-1111-1111-1111-111111111111'
const ROLES: Role[] = ['owner', 'admin', 'manager', 'viewer', 'salesperson']
const ALLOWED: Role[] = ['owner', 'admin']

function signIn(role: string, companyId: string = PASHKOVSKY_COMPANY_ID) {
  session = { user: { id: 'u1' }, membership: { company_id: companyId, role } }
}

beforeEach(() => {
  session = { user: null, membership: null }
  mockFrom.mockClear()
  mockRedirect.mockClear()
})

describe('canAccessTazrim', () => {
  it.each(ROLES)('role %s in the Pashkovsky company', (role) => {
    expect(canAccessTazrim(PASHKOVSKY_COMPANY_ID, role)).toBe(ALLOWED.includes(role))
  })

  it.each(ROLES)('role %s in another company is always denied', (role) => {
    expect(canAccessTazrim(OTHER_COMPANY_ID, role)).toBe(false)
  })

  it('denies missing or unknown values', () => {
    expect(canAccessTazrim(null, 'owner')).toBe(false)
    expect(canAccessTazrim(PASHKOVSKY_COMPANY_ID, null)).toBe(false)
    expect(canAccessTazrim(PASHKOVSKY_COMPANY_ID, 'worker')).toBe(false)
    expect(isValidRole('worker')).toBe(false)
  })
})

describe('canAccessNavPath for the Tazrim section', () => {
  it.each(ROLES)('role %s', (role) => {
    const expected = ALLOWED.includes(role)
    expect(canAccessNavPath(role, '/app/admin/tazrim')).toBe(expected)
    expect(canAccessNavPath(role, '/app/admin/tazrim/checks')).toBe(expected)
  })
})

describe('getTazrimContext', () => {
  it('returns null when signed out', async () => {
    expect(await getTazrimContext()).toBeNull()
  })

  it('returns null when the user has no Pashkovsky membership', async () => {
    session = { user: { id: 'u1' }, membership: null }
    expect(await getTazrimContext()).toBeNull()
  })

  it.each(['manager', 'viewer', 'salesperson'])('returns null for %s', async (role) => {
    signIn(role)
    expect(await getTazrimContext()).toBeNull()
  })

  it('returns null if a membership row for another company slips through', async () => {
    signIn('owner', OTHER_COMPANY_ID)
    expect(await getTazrimContext()).toBeNull()
  })

  it.each(ALLOWED)('returns the context for %s', async (role) => {
    signIn(role)
    const ctx = await getTazrimContext()
    expect(ctx).toMatchObject({ userId: 'u1', companyId: PASHKOVSKY_COMPANY_ID, role })
  })
})

describe('guards', () => {
  it('requireTazrimAccess redirects denied users to the CRM home', async () => {
    signIn('salesperson')
    await expect(requireTazrimAccess()).rejects.toThrow('NEXT_REDIRECT:/app/admin')
  })

  it('requireTazrimAccess lets an owner through', async () => {
    signIn('owner')
    await expect(requireTazrimAccess()).resolves.toMatchObject({ role: 'owner' })
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('requireTazrimActionContext throws Forbidden for denied users', async () => {
    signIn('manager')
    await expect(requireTazrimActionContext()).rejects.toBeInstanceOf(TazrimForbiddenError)
  })
})

describe('server actions reject denied callers before touching any Tazrim table', () => {
  const vendorForm = new FormData()
  vendorForm.set('name', 'Supplier')

  const approveForm = new FormData()
  approveForm.set('id', 'row-1')
  approveForm.set('amount', '100')

  function tazrimTablesTouched() {
    return mockFrom.mock.calls.filter(([table]) => String(table).startsWith('tz_'))
  }

  it.each(['salesperson', 'manager', 'viewer'])('%s is forbidden', async (role) => {
    signIn(role)
    await expect(addVendor(vendorForm)).rejects.toBeInstanceOf(TazrimForbiddenError)
    await expect(deleteVendor('v1')).rejects.toBeInstanceOf(TazrimForbiddenError)
    await expect(approvePayrollExpense(approveForm)).rejects.toBeInstanceOf(TazrimForbiddenError)
    await expect(syncAluminCRM()).rejects.toBeInstanceOf(TazrimForbiddenError)
    expect(tazrimTablesTouched()).toHaveLength(0)
  })

  it('an owner of another company is forbidden', async () => {
    signIn('owner', OTHER_COMPANY_ID)
    await expect(addVendor(vendorForm)).rejects.toBeInstanceOf(TazrimForbiddenError)
    expect(tazrimTablesTouched()).toHaveLength(0)
  })

  it('signed-out callers are forbidden', async () => {
    await expect(deleteVendor('v1')).rejects.toBeInstanceOf(TazrimForbiddenError)
    expect(tazrimTablesTouched()).toHaveLength(0)
  })

  it('an admin may write (control case)', async () => {
    signIn('admin')
    await addVendor(vendorForm)
    expect(tazrimTablesTouched().map(([t]) => t)).toContain('tz_vendors')
  })
})
