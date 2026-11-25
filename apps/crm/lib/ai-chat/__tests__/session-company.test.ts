/**
 * @jest-environment node
 */
import { getOwnedAiSession, getOwnedDirectorSession } from '../session-company'

const CO_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const CO_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const SID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

function mockClient(row: Record<string, unknown> | null) {
  const eqs: Array<{ col: string; val: unknown }> = []
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn((col: string, val: unknown) => {
      eqs.push({ col, val })
      return chain
    }),
    maybeSingle: jest.fn(async () => {
      const companyEq = eqs.find((e) => e.col === 'company_id')
      const idEq = eqs.find((e) => e.col === 'id')
      if (row && companyEq?.val === row.company_id && idEq?.val === row.id) {
        return { data: row, error: null }
      }
      return { data: null, error: null }
    }),
  }
  return {
    from: jest.fn(() => chain),
    _eqs: eqs,
  }
}

describe('session-company helpers', () => {
  it('getOwnedAiSession returns null for other company', async () => {
    const sb = mockClient({ id: SID, client_id: 'c', company_id: CO_B })
    const owned = await getOwnedAiSession(sb as never, SID, CO_A)
    expect(owned).toBeNull()
  })

  it('getOwnedAiSession returns row for matching company', async () => {
    const row = { id: SID, client_id: 'c', company_id: CO_A }
    const sb = mockClient(row)
    const owned = await getOwnedAiSession(sb as never, SID, CO_A)
    expect(owned).toEqual(row)
  })

  it('getOwnedDirectorSession requires company match', async () => {
    const sb = mockClient({ id: SID, company_id: CO_B })
    expect(await getOwnedDirectorSession(sb as never, SID, CO_A)).toBeNull()
  })
})
