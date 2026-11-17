/**
 * Company isolation on the real invoice route handlers.
 * The in-memory client applies only the filters the handler sends, so a
 * missing company_id predicate leaks company B and fails the test.
 * Nothing here talks to Supabase.
 */

import { NextRequest } from 'next/server'

const COMPANY_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const COMPANY_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

const mockGetUser = jest.fn()
const mockGetTazrimContext = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: () => mockGetUser() } }),
}))

jest.mock('@/lib/tazrim/guard', () => ({
  getTazrimContext: () => mockGetTazrimContext(),
}))

jest.mock('@/lib/tazrim/expense-invoices/extract', () => ({
  extractInvoice: async () => ({
    supplierName: 'Delek',
    supplierTaxId: '514111111',
    invoiceNumber: '55',
    invoiceDate: '2026-11-03',
    docType: 'tax_invoice',
    currency: 'ILS',
    netAmount: 100,
    vatRate: 18,
    vatAmount: 18,
    totalAmount: 118,
    allocationNumber: null,
    confidence: 0.8,
    unavailable: false,
    failure: null,
  }),
  prepareInvoiceBytes: async (bytes: Uint8Array, mimeType: string) => ({ ok: true, bytes, mimeType }),
}))

import { GET as listInvoices, POST as uploadInvoice } from '../route'
import { POST as confirmInvoice } from '../[id]/route'
import { GET as readFile } from '../[id]/file/route'
import { GET as reconcile, POST as changeMatch } from '../reconcile/route'
import { POST as changePeriod } from '../period/route'

type Row = Record<string, unknown>

class Store {
  tables: Record<string, Row[]> = {
    tz_expense_documents: [],
    tz_expense_invoices: [],
    tz_cash_events: [],
    tz_vat_period_closures: [],
    tz_audit_log: [],
  }
  signed: string[] = []

  client() {
    const store = this
    return {
      from(table: string) {
        return query(store, table)
      },
      storage: {
        from() {
          return {
            upload: async (path: string) => {
              store.signed.push(`upload:${path}`)
              return { error: null }
            },
            remove: async () => ({ error: null }),
            createSignedUrl: async (path: string) => {
              store.signed.push(`sign:${path}`)
              return { data: { signedUrl: `https://files.example/${path}` }, error: null }
            },
          }
        },
      },
    }
  }
}

function query(store: Store, table: string) {
  const state = {
    op: 'select' as 'select' | 'insert' | 'update' | 'delete',
    filters: [] as Array<(row: Row) => boolean>,
    patch: null as Row | null,
    row: null as Row | null,
  }
  const api = {
    select() {
      return api
    },
    insert(row: Row) {
      state.op = 'insert'
      state.row = { ...row }
      return api
    },
    update(row: Row) {
      state.op = 'update'
      state.patch = row
      return api
    },
    delete() {
      state.op = 'delete'
      return api
    },
    eq(col: string, val: unknown) {
      state.filters.push((row) => row[col] === val)
      return api
    },
    neq(col: string, val: unknown) {
      state.filters.push((row) => row[col] !== val)
      return api
    },
    not(col: string, op: string, val: unknown) {
      if (op === 'is' && val === null) state.filters.push((row) => row[col] != null)
      return api
    },
    gte(col: string, val: string) {
      state.filters.push((row) => String(row[col]) >= val)
      return api
    },
    lte(col: string, val: string) {
      state.filters.push((row) => String(row[col]) <= val)
      return api
    },
    order() {
      return api
    },
    maybeSingle: () => finish(true),
    single: () => finish(true),
    then(resolve: (value: { data: unknown; error: { code?: string } | null }) => unknown, reject: (reason: unknown) => unknown) {
      return finish(false).then(resolve, reject)
    },
  }

  function matches(row: Row) {
    return state.filters.every((filter) => filter(row))
  }

  function finish(one: boolean) {
    const rows = store.tables[table] ?? []
    if (state.op === 'insert') {
      const row: Row = { id: state.row?.id ?? crypto.randomUUID(), ...(state.row ?? {}) }
      if (
        table === 'tz_expense_invoices' &&
        row.confirmed_at &&
        rows.some(
          (existing) =>
            existing.confirmed_at &&
            existing.company_id === row.company_id &&
            existing.supplier_tax_id === row.supplier_tax_id &&
            existing.invoice_number === row.invoice_number,
        )
      ) {
        return Promise.resolve({ data: null, error: { code: '23505' } })
      }
      rows.push(row)
      store.tables[table] = rows
      return Promise.resolve({ data: one ? row : [row], error: null })
    }
    const found = rows.filter(matches)
    if (state.op === 'update') {
      for (const row of found) Object.assign(row, state.patch)
      return Promise.resolve({ data: one ? (found[0] ?? null) : found, error: null })
    }
    if (state.op === 'delete') {
      store.tables[table] = rows.filter((row) => !matches(row))
      return Promise.resolve({ data: found, error: null })
    }
    return Promise.resolve({ data: one ? (found[0] ?? null) : found, error: null })
  }

  return api
}

function signIn(store: Store, companyId: string) {
  const client = store.client()
  mockGetUser.mockResolvedValue({ data: { user: { id: `user-${companyId}` } }, error: null })
  mockGetTazrimContext.mockResolvedValue({
    supabase: client,
    db: client,
    userId: `user-${companyId}`,
    companyId,
    role: 'owner',
  })
}

function anonymous() {
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
  mockGetTazrimContext.mockResolvedValue(null)
}

function pdfRequest(companyId: string) {
  const form = new FormData()
  form.append('file', new File([new Uint8Array([37, 80, 68, 70])], 'invoice.pdf', { type: 'application/pdf' }))
  form.append('company_id', companyId)
  return new NextRequest('http://localhost/api/tazrim/expense-invoices', { method: 'POST', body: form })
}

describe('expense invoice handlers, company A vs company B', () => {
  let store: Store

  beforeEach(() => {
    store = new Store()
    store.tables.tz_expense_documents.push({
      id: 'doc-b',
      company_id: COMPANY_B,
      storage_path: `${COMPANY_B}/secret.pdf`,
      status: 'extracted',
      created_at: '2026-11-02T00:00:00Z',
    })
    store.tables.tz_expense_invoices.push({
      id: 'inv-b',
      company_id: COMPANY_B,
      document_id: 'doc-b',
      supplier_name: 'Secret',
      supplier_tax_id: '500000001',
      invoice_number: 'B-1',
      invoice_date: '2026-11-02',
      doc_type: 'tax_invoice',
      currency: 'ILS',
      net_amount: 100,
      vat_rate: 18,
      vat_amount: 18,
      total_amount: 118,
      vat_recognized_percent: 100,
      vat_period: '2026-11',
      confirmed_at: '2026-11-02T00:00:00Z',
      matched_cash_event_id: null,
    })
    store.tables.tz_cash_events.push({
      id: 'exp-b',
      company_id: COMPANY_B,
      type: 'expense',
      amount: 118,
      due_date: '2026-11-02',
      source: 'manual',
      vendor_id: null,
      vendors: { name: 'Secret' },
    })
    store.tables.tz_vat_period_closures.push({
      id: 'close-b',
      company_id: COMPANY_B,
      vat_period: '2026-10',
    })
  })

  it('returns 401 for an anonymous caller on upload, list, confirm, file, reconcile and period', async () => {
    anonymous()
    const routes = [
      uploadInvoice(pdfRequest(COMPANY_B)),
      listInvoices(),
      confirmInvoice(new NextRequest('http://localhost/api/tazrim/expense-invoices/inv-b', { method: 'POST', body: '{}' }), {
        params: { id: 'inv-b' },
      }),
      readFile(new Request('http://localhost/api/tazrim/expense-invoices/doc-b/file'), { params: { id: 'doc-b' } }),
      reconcile(new NextRequest('http://localhost/api/tazrim/expense-invoices/reconcile?period=2026-11')),
      changePeriod(
        new NextRequest('http://localhost/api/tazrim/expense-invoices/period', {
          method: 'POST',
          body: JSON.stringify({ period: '2026-10', action: 'reopen', note: 'x' }),
        }),
      ),
    ]
    const statuses = await Promise.all(routes.map(async (response) => (await response).status))
    expect(statuses).toEqual([401, 401, 401, 401, 401, 401])
    expect(store.tables.tz_vat_period_closures).toHaveLength(1)
  })

  it('stores the upload under the session company and ignores company_id in the form', async () => {
    signIn(store, COMPANY_A)
    const response = await uploadInvoice(pdfRequest(COMPANY_B))
    expect(response.status).toBe(201)
    const documents = store.tables.tz_expense_documents
    const created = documents.find((row) => row.company_id === COMPANY_A)
    expect(created).toBeDefined()
    expect(String(created?.storage_path)).toMatch(new RegExp(`^${COMPANY_A}/`))
    expect(documents.filter((row) => row.company_id === COMPANY_B)).toHaveLength(1)
    const invoices = store.tables.tz_expense_invoices.filter((row) => row.company_id === COMPANY_A)
    expect(invoices).toHaveLength(1)
    expect(invoices[0].confirmed_at ?? null).toBeNull()
  })

  it('does not list, confirm, open or match company B records for company A', async () => {
    signIn(store, COMPANY_A)
    const list = await listInvoices()
    const listed = (await list.json()) as { invoices: Array<{ id: string; company_id: string }> }
    expect(listed.invoices.find((row) => row.id === 'inv-b' || row.company_id === COMPANY_B)).toBeUndefined()

    const confirm = await confirmInvoice(
      new NextRequest('http://localhost/api/tazrim/expense-invoices/inv-b', {
        method: 'POST',
        body: JSON.stringify({
          companyId: COMPANY_A,
          supplierName: 'Secret',
          supplierTaxId: '500000001',
          invoiceNumber: 'B-1',
          invoiceDate: '2026-11-02',
          docType: 'tax_invoice',
          netAmount: 1,
          vatRate: 18,
          vatAmount: 0.18,
          totalAmount: 1.18,
          vatRecognizedPercent: 100,
        }),
      }),
      { params: { id: 'inv-b' } },
    )
    expect(confirm.status).toBe(404)
    expect(store.tables.tz_expense_invoices.find((row) => row.id === 'inv-b')?.total_amount).toBe(118)

    const file = await readFile(new Request('http://localhost/api/tazrim/expense-invoices/doc-b/file'), {
      params: { id: 'doc-b' },
    })
    expect(file.status).toBe(404)
    expect(store.signed.some((path) => path.includes(COMPANY_B))).toBe(false)

    const view = await reconcile(new NextRequest('http://localhost/api/tazrim/expense-invoices/reconcile?period=2026-11'))
    const body = (await view.json()) as { withoutInvoice: Array<{ id: string }>; proposals: Array<{ invoiceId: string }> }
    expect(body.withoutInvoice?.find((row) => row.id === 'exp-b')).toBeUndefined()
    expect(body.proposals?.find((row) => row.invoiceId === 'inv-b')).toBeUndefined()

    const match = await changeMatch(
      new NextRequest('http://localhost/api/tazrim/expense-invoices/reconcile', {
        method: 'POST',
        body: JSON.stringify({ action: 'match', invoiceId: 'inv-b', expenseId: 'exp-b' }),
      }),
    )
    expect(match.status).toBe(404)
    expect(store.tables.tz_cash_events.find((row) => row.id === 'exp-b')?.amount).toBe(118)

    const reopen = await changePeriod(
      new NextRequest('http://localhost/api/tazrim/expense-invoices/period', {
        method: 'POST',
        body: JSON.stringify({ action: 'reopen', period: '2026-10', note: 'mistake', companyId: COMPANY_B }),
      }),
    )
    expect(reopen.status).toBe(404)
    expect(store.tables.tz_vat_period_closures.find((row) => row.id === 'close-b')).toBeDefined()
  })

  it('puts the original expense amount back when the invoice is unlinked', async () => {
    signIn(store, COMPANY_A)
    store.tables.tz_expense_invoices.push({
      id: 'inv-a',
      company_id: COMPANY_A,
      confirmed_at: '2026-11-03T00:00:00Z',
      invoice_date: '2026-11-03',
      vat_period: '2026-11',
      total_amount: 118,
      supplier_name: 'Delek',
      vendor_id: 'vendor-1',
      doc_type: 'tax_invoice',
      doc_kind: 'tax_invoice',
      matched_cash_event_id: null,
    })
    store.tables.tz_cash_events.push({
      id: 'exp-a',
      company_id: COMPANY_A,
      type: 'expense',
      amount: 114,
      due_date: '2026-11-04',
      source: 'manual',
      vendor_id: 'vendor-1',
      vendors: { name: 'Delek' },
      calc_meta: null,
    })
    const match = await changeMatch(
      new NextRequest('http://localhost/api/tazrim/expense-invoices/reconcile', {
        method: 'POST',
        body: JSON.stringify({ action: 'match', invoiceId: 'inv-a', expenseId: 'exp-a' }),
      }),
    )
    expect(match.status).toBe(200)
    expect(store.tables.tz_cash_events.find((row) => row.id === 'exp-a')?.amount).toBe(118)

    const unlink = await changeMatch(
      new NextRequest('http://localhost/api/tazrim/expense-invoices/reconcile', {
        method: 'POST',
        body: JSON.stringify({ action: 'unlink', invoiceId: 'inv-a' }),
      }),
    )
    expect(unlink.status).toBe(200)
    expect(store.tables.tz_cash_events.find((row) => row.id === 'exp-a')?.amount).toBe(114)
    expect(store.tables.tz_expense_invoices.find((row) => row.id === 'inv-a')?.matched_cash_event_id).toBeNull()
  })
})
