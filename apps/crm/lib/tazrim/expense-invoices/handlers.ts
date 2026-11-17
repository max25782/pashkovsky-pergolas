import { createHash, randomUUID } from 'node:crypto'
import type { TazrimContext } from '@/lib/tazrim/guard'
import {
  EXPENSE_INVOICE_BUCKET,
  MAX_INVOICE_BYTES,
  extensionForMime,
  resolveInvoiceMime,
  safeOriginalFilename,
  type InvoiceDocType,
} from '@/lib/tazrim/expense-invoices/constants'
import { extractInvoice, type InvoiceExtraction } from '@/lib/tazrim/expense-invoices/extract'
import {
  expenseCompatible,
  isPreliminaryExpense,
  monthBounds,
  reconcileInvoices,
  type MatchExpense,
  type MatchInvoice,
} from '@/lib/tazrim/expense-invoices/match'
import {
  isInvoiceDocType,
  normalizeInvoiceNumber,
  normalizeSupplierTaxId,
  validateInvoiceDraft,
  vatPeriodFromDate,
  type InvoiceDraft,
  type ValidationIssue,
} from '@/lib/tazrim/expense-invoices/validate'

export interface HandlerResult {
  status: number
  body: Record<string, unknown>
}

interface DocumentRow {
  id: string
  company_id: string
  storage_path: string
  original_filename: string
  mime_type: string
  size: number
  sha256: string
  status: string
  created_at: string
}

interface InvoiceRow {
  id: string
  company_id: string
  document_id: string
  supplier_name: string | null
  supplier_tax_id: string | null
  invoice_number: string | null
  invoice_date: string | null
  doc_type: string
  currency: string
  net_amount: number | null
  vat_rate: number | null
  vat_amount: number | null
  total_amount: number | null
  allocation_number: string | null
  vat_recognized_percent: number | null
  vat_period: string | null
  category_id: string | null
  vendor_id: string | null
  matched_cash_event_id: string | null
  estimated_amount: number | null
  variance_amount: number | null
  extraction_confidence: number | null
  confirmed_at: string | null
}

interface ExpenseRow {
  id: string
  company_id: string
  type: string
  amount: number | string
  due_date: string
  source: string
  vendor_id: string | null
  vendors: { name: string } | { name: string }[] | null
}

function num(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function vendorName(value: ExpenseRow['vendors']): string | null {
  if (!value) return null
  if (Array.isArray(value)) return value[0]?.name ?? null
  return value.name ?? null
}

function dbError(error: { code?: string; message?: string } | null): HandlerResult | null {
  if (!error) return null
  if (error.code === '23505') {
    return { status: 409, body: { error: 'duplicate', issues: [{ code: 'duplicate_invoice', blocking: true }] } }
  }
  console.error('[tazrim] expense invoice write failed', { code: error.code })
  return { status: 500, body: { error: 'save_failed' } }
}

function pathAllowed(companyId: string, storagePath: string): boolean {
  return storagePath.startsWith(`${companyId}/`) && !storagePath.includes('..')
}

async function periodIsClosed(ctx: TazrimContext, period: string): Promise<boolean> {
  const { data, error } = await ctx.supabase
    .from('tz_vat_period_closures')
    .select('vat_period')
    .eq('company_id', ctx.companyId)
    .eq('vat_period', period)
    .maybeSingle()
  if (error) {
    console.error('[tazrim] period lookup failed', { code: error.code })
    return true
  }
  return Boolean(data)
}

function draftFromExtraction(extraction: InvoiceExtraction, categoryPercent: number): InvoiceDraft {
  const percent = extraction.docType === 'receipt' ? 0 : categoryPercent
  return {
    supplierName: extraction.supplierName ?? '',
    supplierTaxId: extraction.supplierTaxId ?? '',
    invoiceNumber: extraction.invoiceNumber ?? '',
    invoiceDate: extraction.invoiceDate ?? '',
    docType: extraction.docType,
    currency: extraction.currency || 'ILS',
    netAmount: extraction.netAmount,
    vatRate: extraction.vatRate,
    vatAmount: extraction.vatAmount,
    totalAmount: extraction.totalAmount,
    allocationNumber: extraction.allocationNumber,
    vatRecognizedPercent: percent,
    categoryId: null,
    vendorId: null,
  }
}

function draftFromRow(row: InvoiceRow): InvoiceDraft {
  return {
    supplierName: row.supplier_name ?? '',
    supplierTaxId: row.supplier_tax_id ?? '',
    invoiceNumber: row.invoice_number ?? '',
    invoiceDate: row.invoice_date ?? '',
    docType: isInvoiceDocType(row.doc_type) ? row.doc_type : 'other',
    currency: row.currency || 'ILS',
    netAmount: num(row.net_amount),
    vatRate: num(row.vat_rate),
    vatAmount: num(row.vat_amount),
    totalAmount: num(row.total_amount),
    allocationNumber: row.allocation_number,
    vatRecognizedPercent: num(row.vat_recognized_percent) ?? 100,
    categoryId: row.category_id,
    vendorId: row.vendor_id,
  }
}

export function parseDraftBody(body: Record<string, unknown>): InvoiceDraft | null {
  const docType = typeof body.docType === 'string' ? body.docType : ''
  if (!isInvoiceDocType(docType)) return null
  const percent = num(body.vatRecognizedPercent as number | string | null)
  return {
    supplierName: typeof body.supplierName === 'string' ? body.supplierName : '',
    supplierTaxId: typeof body.supplierTaxId === 'string' ? body.supplierTaxId : '',
    invoiceNumber: typeof body.invoiceNumber === 'string' ? body.invoiceNumber : '',
    invoiceDate: typeof body.invoiceDate === 'string' ? body.invoiceDate : '',
    docType,
    currency: typeof body.currency === 'string' && body.currency.trim() ? body.currency.trim() : 'ILS',
    netAmount: num(body.netAmount as number | string | null),
    vatRate: num(body.vatRate as number | string | null),
    vatAmount: num(body.vatAmount as number | string | null),
    totalAmount: num(body.totalAmount as number | string | null),
    allocationNumber: typeof body.allocationNumber === 'string' ? body.allocationNumber : null,
    vatRecognizedPercent: percent ?? Number.NaN,
    categoryId: typeof body.categoryId === 'string' && body.categoryId ? body.categoryId : null,
    vendorId: typeof body.vendorId === 'string' && body.vendorId ? body.vendorId : null,
  }
}

async function confirmedKeys(ctx: TazrimContext): Promise<Array<{ id: string; supplierTaxId: string; invoiceNumber: string }>> {
  const { data, error } = await ctx.supabase
    .from('tz_expense_invoices')
    .select('id, supplier_tax_id, invoice_number')
    .eq('company_id', ctx.companyId)
    .not('confirmed_at', 'is', null)
  if (error) return []
  return ((data ?? []) as Array<{ id: string; supplier_tax_id: string | null; invoice_number: string | null }>).map(
    (row) => ({
      id: row.id,
      supplierTaxId: row.supplier_tax_id ?? '',
      invoiceNumber: row.invoice_number ?? '',
    }),
  )
}

export async function uploadExpenseDocument(
  ctx: TazrimContext,
  file: { filename: string; mimeType: string; bytes: Uint8Array },
): Promise<HandlerResult> {
  const mime = resolveInvoiceMime(file.filename, file.mimeType)
  if (!mime) return { status: 415, body: { error: 'unsupported_type' } }
  if (file.bytes.byteLength === 0) return { status: 400, body: { error: 'empty_file' } }
  if (file.bytes.byteLength > MAX_INVOICE_BYTES) return { status: 413, body: { error: 'file_too_large' } }

  const sha256 = createHash('sha256').update(file.bytes).digest('hex')
  const { data: existing, error: existingError } = await ctx.supabase
    .from('tz_expense_documents')
    .select('id, status')
    .eq('company_id', ctx.companyId)
    .eq('sha256', sha256)
    .maybeSingle()
  if (existingError) return dbError(existingError) ?? { status: 500, body: { error: 'save_failed' } }
  if (existing) {
    return { status: 200, body: { documentId: existing.id, duplicate: true, status: existing.status } }
  }

  const id = randomUUID()
  const storagePath = `${ctx.companyId}/${id}.${extensionForMime(mime)}`
  const uploaded = await ctx.supabase.storage.from(EXPENSE_INVOICE_BUCKET).upload(storagePath, file.bytes, {
    contentType: mime,
    upsert: false,
  })
  if (uploaded.error) {
    console.error('[tazrim] invoice upload failed', { code: (uploaded.error as { statusCode?: string }).statusCode })
    return { status: 500, body: { error: 'upload_failed' } }
  }

  const inserted = await ctx.supabase
    .from('tz_expense_documents')
    .insert({
      id,
      company_id: ctx.companyId,
      storage_path: storagePath,
      original_filename: safeOriginalFilename(file.filename),
      mime_type: mime,
      size: file.bytes.byteLength,
      sha256,
      status: 'uploaded',
      uploaded_by: ctx.userId,
    })
    .select('id')
    .single()
  if (inserted.error) {
    await ctx.supabase.storage.from(EXPENSE_INVOICE_BUCKET).remove([storagePath])
    return dbError(inserted.error) ?? { status: 500, body: { error: 'save_failed' } }
  }

  const extraction = await extractInvoice({ bytes: file.bytes, mimeType: mime })
  const draft = draftFromExtraction(extraction, 100)
  const issues = validateInvoiceDraft(draft, { existingConfirmed: await confirmedKeys(ctx), mode: 'review' })
  const invoiceInsert = await ctx.supabase
    .from('tz_expense_invoices')
    .insert({
      company_id: ctx.companyId,
      document_id: id,
      supplier_name: draft.supplierName || null,
      supplier_tax_id: normalizeSupplierTaxId(draft.supplierTaxId) || null,
      invoice_number: normalizeInvoiceNumber(draft.invoiceNumber) || null,
      invoice_date: vatPeriodFromDate(draft.invoiceDate) ? draft.invoiceDate : null,
      doc_type: draft.docType,
      currency: draft.currency,
      net_amount: draft.netAmount,
      vat_rate: draft.vatRate,
      vat_amount: draft.vatAmount,
      total_amount: draft.totalAmount,
      allocation_number: draft.allocationNumber,
      vat_recognized_percent: draft.vatRecognizedPercent,
      vat_period: vatPeriodFromDate(draft.invoiceDate) || null,
      extraction_json: extraction,
      extraction_confidence: extraction.confidence,
    })
    .select('id')
    .single()

  await ctx.supabase
    .from('tz_expense_documents')
    .update({ status: extraction.unavailable ? 'uploaded' : 'extracted' })
    .eq('id', id)
    .eq('company_id', ctx.companyId)

  return {
    status: 201,
    body: {
      documentId: id,
      invoiceId: invoiceInsert.data?.id ?? null,
      duplicate: false,
      extraction,
      issues,
    },
  }
}

async function loadOwnInvoice(ctx: TazrimContext, invoiceId: string): Promise<InvoiceRow | null> {
  const { data, error } = await ctx.supabase
    .from('tz_expense_invoices')
    .select('*')
    .eq('id', invoiceId)
    .eq('company_id', ctx.companyId)
    .maybeSingle()
  if (error || !data) return null
  const row = data as InvoiceRow
  if (row.company_id !== ctx.companyId) return null
  return row
}

export async function confirmExpenseInvoice(
  ctx: TazrimContext,
  invoiceId: string,
  draft: InvoiceDraft,
): Promise<HandlerResult> {
  const row = await loadOwnInvoice(ctx, invoiceId)
  if (!row) return { status: 404, body: { error: 'not_found' } }

  const percent = draft.docType === 'receipt' ? 0 : draft.vatRecognizedPercent
  const normalized: InvoiceDraft = {
    ...draft,
    supplierTaxId: normalizeSupplierTaxId(draft.supplierTaxId),
    invoiceNumber: normalizeInvoiceNumber(draft.invoiceNumber),
    vatRecognizedPercent: percent,
  }
  const period = vatPeriodFromDate(normalized.invoiceDate)
  if (period && (await periodIsClosed(ctx, period))) {
    return { status: 409, body: { error: 'period_closed' } }
  }

  const issues = validateInvoiceDraft(normalized, {
    existingConfirmed: await confirmedKeys(ctx),
    selfId: row.id,
    mode: 'confirm',
  })
  if (issues.some((issue) => issue.blocking)) {
    return { status: 422, body: { error: 'invalid', issues } }
  }

  const updated = await ctx.supabase
    .from('tz_expense_invoices')
    .update({
      supplier_name: normalized.supplierName.trim(),
      supplier_tax_id: normalized.supplierTaxId,
      invoice_number: normalized.invoiceNumber,
      invoice_date: normalized.invoiceDate,
      doc_type: normalized.docType,
      currency: normalized.currency,
      net_amount: normalized.netAmount,
      vat_rate: normalized.vatRate,
      vat_amount: normalized.vatAmount,
      total_amount: normalized.totalAmount,
      allocation_number: normalized.allocationNumber?.trim() || null,
      vat_recognized_percent: normalized.vatRecognizedPercent,
      vat_period: period,
      category_id: normalized.categoryId,
      vendor_id: normalized.vendorId,
      confirmed_at: new Date().toISOString(),
      confirmed_by: ctx.userId,
    })
    .eq('id', row.id)
    .eq('company_id', ctx.companyId)
    .select('id')
  const failed = dbError(updated.error)
  if (failed) return failed
  if (!updated.data || updated.data.length === 0) return { status: 404, body: { error: 'not_found' } }

  await ctx.supabase
    .from('tz_expense_documents')
    .update({ status: 'confirmed' })
    .eq('id', row.document_id)
    .eq('company_id', ctx.companyId)

  return { status: 200, body: { invoiceId: row.id, issues } }
}

export async function rejectExpenseInvoice(ctx: TazrimContext, invoiceId: string): Promise<HandlerResult> {
  const row = await loadOwnInvoice(ctx, invoiceId)
  if (!row) return { status: 404, body: { error: 'not_found' } }
  if (row.confirmed_at) return { status: 409, body: { error: 'already_confirmed' } }
  const updated = await ctx.supabase
    .from('tz_expense_documents')
    .update({ status: 'rejected' })
    .eq('id', row.document_id)
    .eq('company_id', ctx.companyId)
    .select('id')
  if (!updated.data || updated.data.length === 0) return { status: 404, body: { error: 'not_found' } }
  return { status: 200, body: { invoiceId: row.id, status: 'rejected' } }
}

export async function listExpenseInvoices(ctx: TazrimContext): Promise<HandlerResult> {
  const { data, error } = await ctx.supabase
    .from('tz_expense_invoices')
    .select('id, company_id, document_id, supplier_name, invoice_number, vat_period, doc_type, confirmed_at, matched_cash_event_id')
    .eq('company_id', ctx.companyId)
  if (error) return dbError(error) ?? { status: 500, body: { error: 'save_failed' } }
  const rows = ((data ?? []) as Array<{ company_id: string }>).filter((row) => row.company_id === ctx.companyId)
  return { status: 200, body: { invoices: rows } }
}

export async function signedInvoiceUrl(ctx: TazrimContext, documentId: string): Promise<HandlerResult> {
  const { data, error } = await ctx.supabase
    .from('tz_expense_documents')
    .select('id, company_id, storage_path')
    .eq('id', documentId)
    .eq('company_id', ctx.companyId)
    .maybeSingle()
  if (error || !data) return { status: 404, body: { error: 'not_found' } }
  const row = data as { company_id: string; storage_path: string }
  if (row.company_id !== ctx.companyId || !pathAllowed(ctx.companyId, row.storage_path)) {
    return { status: 404, body: { error: 'not_found' } }
  }
  const signed = await ctx.supabase.storage.from(EXPENSE_INVOICE_BUCKET).createSignedUrl(row.storage_path, 120)
  if (signed.error || !signed.data?.signedUrl) return { status: 404, body: { error: 'not_found' } }
  return { status: 200, body: { url: signed.data.signedUrl } }
}

function toMatchInvoice(row: InvoiceRow): MatchInvoice | null {
  if (!row.invoice_date || num(row.total_amount) === null) return null
  return {
    id: row.id,
    companyId: row.company_id,
    vendorId: row.vendor_id,
    supplierName: row.supplier_name ?? '',
    totalAmount: num(row.total_amount) as number,
    invoiceDate: row.invoice_date,
  }
}

function toMatchExpense(row: ExpenseRow): MatchExpense {
  return {
    id: row.id,
    companyId: row.company_id,
    vendorId: row.vendor_id,
    vendorName: vendorName(row.vendors),
    amount: num(row.amount) ?? 0,
    dueDate: row.due_date,
    source: row.source,
  }
}

export async function loadReconciliation(ctx: TazrimContext, period: string): Promise<HandlerResult> {
  if (!/^\d{4}-\d{2}$/.test(period)) return { status: 400, body: { error: 'bad_period' } }
  const bounds = monthBounds(period)
  if (!bounds) return { status: 400, body: { error: 'bad_period' } }

  const [documentsResult, invoicesResult, expensesResult, closureResult] = await Promise.all([
    ctx.supabase
      .from('tz_expense_documents')
      .select('id, company_id, status, created_at')
      .eq('company_id', ctx.companyId),
    ctx.supabase.from('tz_expense_invoices').select('*').eq('company_id', ctx.companyId).eq('vat_period', period),
    ctx.supabase
      .from('tz_cash_events')
      .select('id, company_id, type, amount, due_date, source, vendor_id, vendors:tz_vendors(name)')
      .eq('company_id', ctx.companyId)
      .eq('type', 'expense')
      .gte('due_date', bounds.from)
      .lte('due_date', bounds.to),
    ctx.supabase
      .from('tz_vat_period_closures')
      .select('vat_period, closed_at, note')
      .eq('company_id', ctx.companyId)
      .eq('vat_period', period)
      .maybeSingle(),
  ])

  const documents = ((documentsResult.data ?? []) as DocumentRow[]).filter((row) => row.company_id === ctx.companyId)
  const invoices = ((invoicesResult.data ?? []) as InvoiceRow[]).filter((row) => row.company_id === ctx.companyId)
  const expenses = ((expensesResult.data ?? []) as ExpenseRow[]).filter(
    (row) => row.company_id === ctx.companyId && row.type === 'expense',
  )

  const inMonth = (iso: string) => iso.slice(0, 7) === period
  const uploaded = documents.filter((row) => inMonth(row.created_at)).length
  const confirmedRows = invoices.filter((row) => row.confirmed_at)
  const awaiting = invoices.filter((row) => !row.confirmed_at).length
  const openInvoices = confirmedRows.filter((row) => !row.matched_cash_event_id)
  const matchInputs = openInvoices.flatMap((row) => {
    const invoice = toMatchInvoice(row)
    return invoice ? [invoice] : []
  })
  const expenseInputs = expenses
    .filter((row) => isPreliminaryExpense(row.source) && inMonth(row.due_date))
    .map(toMatchExpense)
  const reconciliation = reconcileInvoices(matchInputs, expenseInputs)
  const matchedIds = new Set(
    reconciliation.matches.flatMap((match) => (match.status === 'matched' ? [match.expenseId] : [])),
  )
  const alreadyLinked = new Set(
    confirmedRows.flatMap((row) => (row.matched_cash_event_id ? [row.matched_cash_event_id] : [])),
  )
  const withoutInvoice = expenseInputs.filter((expense) => !matchedIds.has(expense.id) && !alreadyLinked.has(expense.id))
  const variances = confirmedRows
    .filter((row) => row.variance_amount !== null && Number(row.variance_amount) !== 0)
    .map((row) => ({
      invoiceId: row.id,
      expenseId: row.matched_cash_event_id,
      estimatedAmount: num(row.estimated_amount),
      varianceAmount: num(row.variance_amount),
    }))

  return {
    status: 200,
    body: {
      period,
      uploaded,
      confirmed: confirmedRows.length,
      awaiting,
      variances,
      withoutInvoice,
      proposals: reconciliation.matches,
      closed: closureResult.data ?? null,
    },
  }
}

export async function applyInvoiceMatch(
  ctx: TazrimContext,
  invoiceId: string,
  expenseId: string,
): Promise<HandlerResult> {
  const invoice = await loadOwnInvoice(ctx, invoiceId)
  if (!invoice || !invoice.confirmed_at) return { status: 404, body: { error: 'not_found' } }
  const period = invoice.vat_period ?? ''
  if (period && (await periodIsClosed(ctx, period))) return { status: 409, body: { error: 'period_closed' } }

  const { data: expense, error } = await ctx.supabase
    .from('tz_cash_events')
    .select('id, company_id, type, amount, due_date, source, vendor_id, vendors:tz_vendors(name)')
    .eq('id', expenseId)
    .eq('company_id', ctx.companyId)
    .maybeSingle()
  if (error || !expense) return { status: 404, body: { error: 'not_found' } }
  const expenseRow = expense as ExpenseRow
  if (expenseRow.company_id !== ctx.companyId) return { status: 404, body: { error: 'not_found' } }

  const matchInvoice = toMatchInvoice(invoice)
  if (!matchInvoice || !expenseCompatible(matchInvoice, toMatchExpense(expenseRow))) {
    return { status: 409, body: { error: 'not_a_match' } }
  }

  const { data: taken } = await ctx.supabase
    .from('tz_expense_invoices')
    .select('id')
    .eq('company_id', ctx.companyId)
    .eq('matched_cash_event_id', expenseId)
    .neq('id', invoice.id)
  if (taken && taken.length > 0) return { status: 409, body: { error: 'duplicate' } }

  const estimated = num(expenseRow.amount) ?? 0
  const actual = num(invoice.total_amount) ?? 0
  const amountUpdate = await ctx.supabase
    .from('tz_cash_events')
    .update({ amount: actual, vendor_id: invoice.vendor_id ?? expenseRow.vendor_id })
    .eq('id', expenseId)
    .eq('company_id', ctx.companyId)
    .select('id')
  if (!amountUpdate.data || amountUpdate.data.length === 0) return { status: 404, body: { error: 'not_found' } }

  const link = await ctx.supabase
    .from('tz_expense_invoices')
    .update({
      matched_cash_event_id: expenseId,
      estimated_amount: estimated,
      variance_amount: Math.round((actual - estimated) * 100) / 100,
      vendor_id: invoice.vendor_id ?? expenseRow.vendor_id,
    })
    .eq('id', invoice.id)
    .eq('company_id', ctx.companyId)
    .select('id')
  if (!link.data || link.data.length === 0) return { status: 404, body: { error: 'not_found' } }
  return {
    status: 200,
    body: { invoiceId: invoice.id, expenseId, estimatedAmount: estimated, varianceAmount: actual - estimated },
  }
}

export async function createExpenseFromInvoice(ctx: TazrimContext, invoiceId: string): Promise<HandlerResult> {
  const invoice = await loadOwnInvoice(ctx, invoiceId)
  if (!invoice || !invoice.confirmed_at || !invoice.invoice_date || num(invoice.total_amount) === null) {
    return { status: 404, body: { error: 'not_found' } }
  }
  if (invoice.vat_period && (await periodIsClosed(ctx, invoice.vat_period))) {
    return { status: 409, body: { error: 'period_closed' } }
  }
  if (invoice.matched_cash_event_id) return { status: 409, body: { error: 'already_matched' } }

  const created = await ctx.supabase
    .from('tz_cash_events')
    .insert({
      company_id: ctx.companyId,
      type: 'expense',
      amount: num(invoice.total_amount),
      currency: invoice.currency || 'ILS',
      due_date: invoice.invoice_date,
      status: 'planned',
      source: 'supplier_invoice',
      vendor_id: invoice.vendor_id,
      category_id: invoice.category_id,
      notes: null,
    })
    .select('id')
    .single()
  const failed = dbError(created.error)
  if (failed) return failed
  if (!created.data) return { status: 500, body: { error: 'save_failed' } }

  await ctx.supabase
    .from('tz_expense_invoices')
    .update({
      matched_cash_event_id: created.data.id,
      estimated_amount: null,
      variance_amount: 0,
    })
    .eq('id', invoice.id)
    .eq('company_id', ctx.companyId)

  return { status: 201, body: { invoiceId: invoice.id, expenseId: created.data.id } }
}

async function writePeriodAudit(
  ctx: TazrimContext,
  action: 'vat_period_close' | 'vat_period_reopen',
  recordId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await ctx.supabase.from('tz_audit_log').insert({
    company_id: ctx.companyId,
    table_name: 'tz_vat_period_closures',
    record_id: recordId,
    action,
    changed_by: ctx.userId,
    new_data: payload,
  })
}

export async function closeVatPeriod(ctx: TazrimContext, period: string, note: string): Promise<HandlerResult> {
  if (!/^\d{4}-\d{2}$/.test(period)) return { status: 400, body: { error: 'bad_period' } }
  const { data: invoices } = await ctx.supabase
    .from('tz_expense_invoices')
    .select('vat_amount, vat_recognized_percent, doc_type, confirmed_at')
    .eq('company_id', ctx.companyId)
    .eq('vat_period', period)
    .not('confirmed_at', 'is', null)
  const recognized = ((invoices ?? []) as InvoiceRow[]).reduce((sum, row) => {
    if (!row.confirmed_at || row.doc_type === 'receipt') return sum
    return sum + ((num(row.vat_amount) ?? 0) * (num(row.vat_recognized_percent) ?? 0)) / 100
  }, 0)

  const inserted = await ctx.supabase
    .from('tz_vat_period_closures')
    .insert({
      company_id: ctx.companyId,
      vat_period: period,
      closed_by: ctx.userId,
      note: note.trim() || null,
    })
    .select('id')
    .single()
  const failed = dbError(inserted.error)
  if (failed) return failed
  if (!inserted.data) return { status: 500, body: { error: 'save_failed' } }

  await writePeriodAudit(ctx, 'vat_period_close', inserted.data.id, {
    vat_period: period,
    recognized_input_vat: Math.round(recognized * 100) / 100,
    invoice_count: (invoices ?? []).length,
  })
  return { status: 200, body: { period, closed: true } }
}

export async function reopenVatPeriod(ctx: TazrimContext, period: string, note: string): Promise<HandlerResult> {
  if (!/^\d{4}-\d{2}$/.test(period)) return { status: 400, body: { error: 'bad_period' } }
  if (!note.trim()) return { status: 400, body: { error: 'note_required' } }
  const { data: existing } = await ctx.supabase
    .from('tz_vat_period_closures')
    .select('id, company_id')
    .eq('company_id', ctx.companyId)
    .eq('vat_period', period)
    .maybeSingle()
  if (!existing || (existing as { company_id: string }).company_id !== ctx.companyId) {
    return { status: 404, body: { error: 'not_found' } }
  }
  const id = (existing as { id: string }).id
  await writePeriodAudit(ctx, 'vat_period_reopen', id, { vat_period: period })
  const removed = await ctx.supabase
    .from('tz_vat_period_closures')
    .delete()
    .eq('id', id)
    .eq('company_id', ctx.companyId)
    .select('id')
  if (!removed.data || removed.data.length === 0) return { status: 404, body: { error: 'not_found' } }
  return { status: 200, body: { period, closed: false } }
}

export type { InvoiceDocType, ValidationIssue }
