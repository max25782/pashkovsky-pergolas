import type { SupabaseClient } from '@supabase/supabase-js'
import {
  countDealsByStage,
  loadCompanyStages,
  resetCompanyStages,
  saveCompanyStages,
  seedCompanyStages,
  stagesFromRegistration,
} from '../stage-store'
import { DEFAULT_STAGES, stagesFromTemplate, type StageDraft } from '../stages'

type Row = Record<string, unknown>
type Db = Record<string, Row[]>

/** In-memory stand-in for the parts of the query builder the stage store uses. */
function fakeSupabase(db: Db, options: { missingTable?: boolean } = {}) {
  function builder(table: string) {
    let op: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select'
    let payload: Row | Row[] | undefined
    let conflict: string[] = []
    const eqs: Array<[string, unknown]> = []
    const ins: Array<[string, unknown[]]> = []
    let orderBy: string | undefined
    let window: [number, number] | undefined
    let max: number | undefined

    const matches = (r: Row) =>
      eqs.every(([k, v]) => r[k] === v) && ins.every(([k, v]) => v.includes(r[k]))

    function run(): { data: unknown; error: { code?: string; message: string } | null } {
      if (options.missingTable && table === 'deal_stages') {
        return { data: null, error: { code: '42P01', message: 'relation "public.deal_stages" does not exist' } }
      }
      const rows = (db[table] ??= [])
      if (op === 'insert') {
        for (const r of [payload].flat() as Row[]) rows.push({ ...r })
        return { data: null, error: null }
      }
      if (op === 'upsert') {
        for (const r of payload as Row[]) {
          const at = rows.findIndex((x) => conflict.every((c) => x[c] === r[c]))
          if (at >= 0) Object.assign(rows[at], r)
          else rows.push({ ...r })
        }
        return { data: null, error: null }
      }
      if (op === 'update') {
        rows.filter(matches).forEach((r) => Object.assign(r, payload))
        return { data: null, error: null }
      }
      if (op === 'delete') {
        db[table] = rows.filter((r) => !matches(r))
        return { data: null, error: null }
      }
      let hit = rows.filter(matches).map((r) => ({ ...r }))
      if (orderBy) hit = hit.sort((a, b) => Number(a[orderBy as string]) - Number(b[orderBy as string]))
      if (window) hit = hit.slice(window[0], window[1] + 1)
      if (max !== undefined) hit = hit.slice(0, max)
      return { data: hit, error: null }
    }

    const api = {
      select: () => api,
      insert(r: Row | Row[]) { op = 'insert'; payload = r; return api },
      upsert(r: Row[], o: { onConflict: string }) { op = 'upsert'; payload = r; conflict = o.onConflict.split(','); return api },
      update(p: Row) { op = 'update'; payload = p; return api },
      delete() { op = 'delete'; return api },
      eq(k: string, v: unknown) { eqs.push([k, v]); return api },
      in(k: string, v: unknown[]) { ins.push([k, v]); return api },
      order(c: string) { orderBy = c; return api },
      range(a: number, b: number) { window = [a, b]; return api },
      limit(n: number) { max = n; return api },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
        return Promise.resolve(run()).then(resolve, reject)
      },
    }
    return api
  }
  return { from: (t: string) => builder(t) } as unknown as SupabaseClient
}

const FIRM = 'firm-1'
const OTHER = 'firm-2'

function rowsOf(db: Db, company: string) {
  return (db.deal_stages ?? []).filter((r) => r.company_id === company).sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
}

function drafts(db: Db, company: string, patch: Record<string, Partial<StageDraft>> = {}): StageDraft[] {
  return rowsOf(db, company).map((r) => ({
    key: r.key as string,
    role: r.role as StageDraft['role'],
    color: r.color as string,
    label: (r.label as string | null) ?? (r.key as string),
    labels: r.labels as StageDraft['labels'],
    isActive: r.is_active as boolean,
    ...patch[r.key as string],
  }))
}

describe('loadCompanyStages', () => {
  it('shows the aluminium set to a firm with no rows (Pashkovsky before migration)', async () => {
    const result = await loadCompanyStages(fakeSupabase({}), FIRM)
    expect(result.isDefault).toBe(true)
    expect(result.stages.map((s) => s.key)).toEqual(DEFAULT_STAGES.map((s) => s.key))
  })

  it('does not break while migration 063 is not applied', async () => {
    const result = await loadCompanyStages(fakeSupabase({}, { missingTable: true }), FIRM)
    expect(result.isDefault).toBe(true)
    expect(result.stages).toHaveLength(9)
  })

  it('reads only the firm\'s own rows, in order', async () => {
    const db: Db = { deal_stages: [] }
    await seedCompanyStages(fakeSupabase(db), FIRM, stagesFromTemplate('construction'))
    await seedCompanyStages(fakeSupabase(db), OTHER, stagesFromTemplate('aluminum'))
    const result = await loadCompanyStages(fakeSupabase(db), FIRM)
    expect(result.isDefault).toBe(false)
    expect(result.stages.map((s) => s.key)).toEqual(['signed', 'in_progress', 'completed'])
  })
})

describe('new firm sees only the chosen columns', () => {
  it('stores exactly the three chosen stages, with generated keys, and no aluminium column', async () => {
    const parsed = stagesFromRegistration([
      { label: 'Подписано', role: 'signed', color: 'bg-yellow-600' },
      { label: 'В работе', role: 'in_production', color: 'bg-orange-500' },
      { label: 'Закончено', role: 'completed', color: 'bg-emerald-600' },
    ])
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const db: Db = { deal_stages: [] }
    await seedCompanyStages(fakeSupabase(db), FIRM, parsed.stages)

    const loaded = await loadCompanyStages(fakeSupabase(db), FIRM)
    expect(loaded.stages).toHaveLength(3)
    expect(loaded.stages.map((s) => s.label)).toEqual(['Подписано', 'В работе', 'Закончено'])
    expect(loaded.stages.every((s) => /^custom_[a-z0-9]{6}$/.test(s.key))).toBe(true)
    expect(loaded.stages.map((s) => s.key)).not.toContain('new')
  })

  it('refuses an empty list, a missing name and an unknown color', () => {
    expect(stagesFromRegistration([])).toEqual({ ok: false, errors: ['at_least_one_active_stage'] })
    const bad = stagesFromRegistration([{ label: '', color: 'bg-nope' }])
    expect(bad.ok).toBe(false)
  })
})

describe('saveCompanyStages', () => {
  async function constructionFirm() {
    const db: Db = {
      deal_stages: [],
      deals: [
        { id: 'a', company_id: FIRM, stage: 'signed' },
        { id: 'b', company_id: FIRM, stage: 'in_progress' },
        { id: 'c', company_id: FIRM, stage: 'in_progress' },
        { id: 'z', company_id: OTHER, stage: 'in_progress' },
      ],
    }
    await seedCompanyStages(fakeSupabase(db), FIRM, stagesFromTemplate('construction'))
    return db
  }

  it('renames a column; its key and its deals are untouched', async () => {
    const db = await constructionFirm()
    const result = await saveCompanyStages(fakeSupabase(db), FIRM, {
      drafts: drafts(db, FIRM, { in_progress: { label: 'Executing', labels: null } }),
    })
    expect(result.ok).toBe(true)
    const row = rowsOf(db, FIRM).find((r) => r.key === 'in_progress')
    expect(row?.label).toBe('Executing')
    expect(db.deals.filter((d) => d.stage === 'in_progress')).toHaveLength(3)
  })

  it('reorders columns', async () => {
    const db = await constructionFirm()
    const list = drafts(db, FIRM).reverse()
    await saveCompanyStages(fakeSupabase(db), FIRM, { drafts: list, acknowledgeWarnings: true })
    expect(rowsOf(db, FIRM).map((r) => r.key)).toEqual(['completed', 'in_progress', 'signed'])
  })

  it('adds a custom column with a generated key', async () => {
    const db = await constructionFirm()
    const result = await saveCompanyStages(fakeSupabase(db), FIRM, {
      drafts: [...drafts(db, FIRM), { color: 'bg-teal-600', label: 'Warranty', isActive: true }],
    })
    expect(result.ok).toBe(true)
    expect(rowsOf(db, FIRM)).toHaveLength(4)
    expect(String(rowsOf(db, FIRM)[3].key)).toMatch(/^custom_/)
    expect(rowsOf(db, FIRM)[3].role).toBeNull()
  })

  it('refuses to hide a column that holds deals, and says how many', async () => {
    const db = await constructionFirm()
    const result = await saveCompanyStages(fakeSupabase(db), FIRM, {
      drafts: drafts(db, FIRM, { in_progress: { isActive: false } }),
      acknowledgeWarnings: true,
    })
    expect(result).toMatchObject({ ok: false, status: 409, code: 'stage_has_deals', blocked: [{ key: 'in_progress', dealCount: 2 }] })
    expect(rowsOf(db, FIRM).find((r) => r.key === 'in_progress')?.is_active).toBe(true)
  })

  it('moves the deals to the chosen column, then hides it', async () => {
    const db = await constructionFirm()
    const result = await saveCompanyStages(fakeSupabase(db), FIRM, {
      drafts: drafts(db, FIRM, { in_progress: { isActive: false } }),
      moves: { in_progress: 'signed' },
      acknowledgeWarnings: true,
    })
    expect(result.ok).toBe(true)
    expect(db.deals.filter((d) => d.company_id === FIRM).map((d) => d.stage)).toEqual(['signed', 'signed', 'signed'])
    // Another firm's deal with the same key is not touched.
    expect(db.deals.find((d) => d.id === 'z')?.stage).toBe('in_progress')
    expect(rowsOf(db, FIRM).find((r) => r.key === 'in_progress')?.is_active).toBe(false)
  })

  it('deletes an empty column', async () => {
    const db = await constructionFirm()
    db.deals = []
    const list = drafts(db, FIRM).filter((d) => d.key !== 'signed')
    const result = await saveCompanyStages(fakeSupabase(db), FIRM, { drafts: list, acknowledgeWarnings: true })
    expect(result.ok).toBe(true)
    expect(rowsOf(db, FIRM).map((r) => r.key)).toEqual(['in_progress', 'completed'])
  })

  it('asks for confirmation before removing a column with logic', async () => {
    const db = await constructionFirm()
    db.deals = []
    const list = drafts(db, FIRM).filter((d) => d.key !== 'completed')
    const result = await saveCompanyStages(fakeSupabase(db), FIRM, { drafts: list })
    expect(result).toMatchObject({ ok: false, status: 409, code: 'stage_warnings', noCompletedStage: true })
    expect(rowsOf(db, FIRM)).toHaveLength(3)
  })

  it('does not let the key or the meaning of a column change', async () => {
    const db = await constructionFirm()
    const wrongRole = await saveCompanyStages(fakeSupabase(db), FIRM, {
      drafts: drafts(db, FIRM, { completed: { role: null } }),
    })
    expect(wrongRole).toMatchObject({ ok: false, status: 400 })
    const invented = await saveCompanyStages(fakeSupabase(db), FIRM, {
      drafts: [...drafts(db, FIRM), { key: 'hacked', color: 'bg-gray-500', label: 'x', isActive: true }],
    })
    expect(invented).toMatchObject({ ok: false, status: 400 })
  })

  it('reports that the migration is missing instead of failing', async () => {
    const result = await saveCompanyStages(fakeSupabase({}, { missingTable: true }), FIRM, { drafts: [] })
    expect(result).toEqual({ ok: false, status: 503, code: 'migration_not_applied' })
  })
})

describe('resetCompanyStages', () => {
  it('returns a repair firm to its template; deals in columns that go must be moved first', async () => {
    const db: Db = { deal_stages: [], deals: [{ id: 'a', company_id: FIRM, stage: 'custom_x' }] }
    await seedCompanyStages(fakeSupabase(db), FIRM, [
      { key: 'custom_x', role: 'completed', color: 'bg-gray-500', label: 'Mine', labels: null, sortOrder: 0, isActive: true },
    ])
    const blocked = await resetCompanyStages(fakeSupabase(db), FIRM, 'repair', { acknowledgeWarnings: true })
    expect(blocked).toMatchObject({ ok: false, status: 409, code: 'stage_has_deals' })

    const result = await resetCompanyStages(fakeSupabase(db), FIRM, 'repair', {
      moves: { custom_x: 'done' },
      acknowledgeWarnings: true,
    })
    expect(result.ok).toBe(true)
    expect(rowsOf(db, FIRM).map((r) => r.key)).toEqual(['request', 'estimate_agreed', 'in_progress', 'done'])
    expect(db.deals[0].stage).toBe('done')
  })
})

describe('countDealsByStage', () => {
  it('counts per stage for one firm', async () => {
    const db: Db = {
      deals: [
        { company_id: FIRM, stage: 'new' },
        { company_id: FIRM, stage: 'new' },
        { company_id: OTHER, stage: 'new' },
      ],
    }
    expect(await countDealsByStage(fakeSupabase(db), FIRM)).toEqual({ new: 2 })
  })
})
