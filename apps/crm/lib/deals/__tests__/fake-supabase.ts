/**
 * Minimal in-memory stand-in for the supabase-js query builder (select / insert / update /
 * delete with eq filters). Enough for the deal-price tests; not a general mock.
 */
export type Row = Record<string, unknown>
export type Db = Record<string, Row[]>

interface Result {
  data: unknown
  error: { message: string } | null
}

export interface FakeOptions {
  /** Table.operation pairs that fail, e.g. 'deals.update'. */
  failOn?: Set<string>
  rpc?: (name: string, args: Record<string, unknown>) => unknown
}

let counter = 0

export function createFakeSupabase(db: Db, options: FakeOptions = {}) {
  const failOn = options.failOn ?? new Set<string>()

  function builder(table: string) {
    const rows = () => (db[table] ??= [])
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select'
    let payload: Row | undefined
    const filters: Array<[string, unknown]> = []

    const matches = (r: Row) => filters.every(([k, v]) => r[k] === v)

    function run(): Result {
      if (failOn.has(`${table}.${op}`)) return { data: null, error: { message: `${table}.${op} failed` } }
      if (op === 'insert') {
        const row = { id: `${table}-${++counter}`, ...(payload as Row) }
        rows().push(row)
        return { data: [row], error: null }
      }
      const hit = rows().filter(matches)
      if (op === 'update') {
        hit.forEach((r) => Object.assign(r, payload))
        return { data: hit.map((r) => ({ ...r })), error: null }
      }
      if (op === 'delete') {
        db[table] = rows().filter((r) => !matches(r))
        return { data: null, error: null }
      }
      return { data: hit.map((r) => ({ ...r })), error: null }
    }

    const api = {
      select(columns?: string) {
        void columns
        return api
      },
      insert(row: Row) {
        op = 'insert'
        payload = row
        return api
      },
      update(patch: Row) {
        op = 'update'
        payload = patch
        return api
      },
      delete() {
        op = 'delete'
        return api
      },
      eq(col: string, value: unknown) {
        filters.push([col, value])
        return api
      },
      async single(): Promise<Result> {
        const r = run()
        const list = (r.data as Row[] | null) ?? []
        return { data: list[0] ?? null, error: r.error ?? (list[0] ? null : { message: 'no rows' }) }
      },
      async maybeSingle(): Promise<Result> {
        const r = run()
        const list = (r.data as Row[] | null) ?? []
        return { data: list[0] ?? null, error: r.error }
      },
      then(resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) {
        return Promise.resolve(run()).then(resolve, reject)
      },
    }
    return api
  }

  return {
    from: (table: string) => builder(table),
    rpc: async (name: string, args: Record<string, unknown>) => ({
      data: options.rpc ? options.rpc(name, args) : null,
      error: null,
    }),
  }
}
