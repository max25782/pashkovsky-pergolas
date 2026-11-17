import type { SupabaseClient } from '@supabase/supabase-js'
import { nextMonth, vatExternalId, type CalculatedCashRow } from '@/lib/tazrim/vat-pension-rows'
import type { PeriodInvoiceInput } from '@/lib/tazrim/expense-invoices/period-vat'
import { isInvoiceDocType } from '@/lib/tazrim/expense-invoices/validate'

interface InvoiceVatRow {
  vat_period: string | null
  doc_type: string
  doc_kind: string | null
  vendor_id: string | null
  deal_id: string | null
  net_amount: number | string | null
  vat_amount: number | string | null
  vat_recognized_percent: number | string | null
  confirmed_at: string | null
  superseded_by: string | null
}

function isMissingRelation(error: { code?: string; message?: string }): boolean {
  if (error.code === 'PGRST205' || error.code === '42P01') return true
  const message = error.message ?? ''
  return message.includes('does not exist') || message.includes('schema cache')
}

function toNumber(value: number | string | null): number | null {
  if (value === null || value === undefined) return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Confirmed invoices and closed periods for the VAT sync.
 * Returns null when migration 070 is not applied yet, so the sync keeps the
 * materials estimate. Errors are logged by code only.
 */
export async function loadInvoiceVatState(
  supabase: SupabaseClient,
  companyId: string,
): Promise<{ invoices: PeriodInvoiceInput[]; closed: Set<string> } | null> {
  const [invoicesResult, closuresResult, vendorsResult] = await Promise.all([
    supabase
      .from('tz_expense_invoices')
      .select('vat_period, doc_type, doc_kind, vendor_id, deal_id, net_amount, vat_amount, vat_recognized_percent, confirmed_at, superseded_by')
      .eq('company_id', companyId)
      .not('confirmed_at', 'is', null),
    supabase.from('tz_vat_period_closures').select('vat_period').eq('company_id', companyId),
    supabase.from('tz_vendors').select('id, issues_monthly_invoice').eq('company_id', companyId),
  ])

  if (invoicesResult.error) {
    if (isMissingRelation(invoicesResult.error)) return null
    console.error('[tazrim] invoice vat read failed', { code: invoicesResult.error.code })
    throw new Error('Не удалось прочитать счета поставщиков')
  }
  if (closuresResult.error) {
    if (isMissingRelation(closuresResult.error)) return null
    console.error('[tazrim] vat period read failed', { code: closuresResult.error.code })
    throw new Error('Не удалось прочитать закрытые периоды НДС')
  }
  if (vendorsResult.error) {
    if (isMissingRelation(vendorsResult.error) || vendorsResult.error.code === '42703') return null
    console.error('[tazrim] vendor vat flag read failed', { code: vendorsResult.error.code })
    throw new Error('Не удалось прочитать поставщиков')
  }

  const monthlyVendors = new Set(
    ((vendorsResult.data ?? []) as Array<{ id: string; issues_monthly_invoice?: boolean }>)
      .filter((vendor) => vendor.issues_monthly_invoice === true)
      .map((vendor) => vendor.id),
  )
  const invoices: PeriodInvoiceInput[] = ((invoicesResult.data ?? []) as InvoiceVatRow[])
    .filter((row) => row.vat_period && isInvoiceDocType(row.doc_type))
    .map((row) => ({
      vatPeriod: row.vat_period as string,
      docType: row.doc_type as PeriodInvoiceInput['docType'],
      docKind: row.doc_kind === 'tax_invoice' ? 'tax_invoice' : 'preliminary',
      vendorId: row.vendor_id,
      dealId: row.deal_id,
      netAmount: toNumber(row.net_amount),
      vatAmount: toNumber(row.vat_amount),
      vatRecognizedPercent: toNumber(row.vat_recognized_percent) ?? 100,
      confirmed: Boolean(row.confirmed_at),
      superseded: Boolean(row.superseded_by),
      issuesMonthlyInvoice: row.vendor_id ? monthlyVendors.has(row.vendor_id) : false,
    }))

  const closed = new Set<string>(
    ((closuresResult.data ?? []) as Array<{ vat_period: string }>).map((row) => row.vat_period),
  )
  return { invoices, closed }
}

/** External ids of closed VAT periods, including months the current sync did not rebuild. */
export function lockedVatExternalIds(companyId: string, closedSourceMonths: ReadonlySet<string>): string[] {
  return [...closedSourceMonths].map((month) => vatExternalId(companyId, nextMonth(month)))
}

export function mergeLockedIds(fromRows: readonly string[], fromClosures: readonly string[]): string[] {
  return [...new Set([...fromRows, ...fromClosures])]
}

export function calculatedExternalIds(rows: readonly CalculatedCashRow[], locked: readonly string[]): string[] {
  return [...new Set([...rows.map((row) => row.external_id), ...locked])]
}
