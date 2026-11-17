/** Private Supabase Storage bucket. Path prefix is always the company id. */
export const EXPENSE_INVOICE_BUCKET = 'tz-expense-invoices'

/** 15 MiB. Phone photos of a invoice page fit; the bucket enforces the same cap. */
export const MAX_INVOICE_BYTES = 15 * 1024 * 1024
/** Stay under the Vercel request body limit of about 4.5 MB, including multipart overhead. */
export const REQUEST_BODY_BYTES = 4 * 1024 * 1024

export const ALLOWED_INVOICE_MIME = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const

export type AllowedInvoiceMime = (typeof ALLOWED_INVOICE_MIME)[number]

/** Arithmetic of net × rate and net + VAT may differ by up to 2 agorot. */
export const VAT_AGOROT_TOLERANCE = 0.02

/**
 * A preliminary expense matches an invoice when the amounts differ by at most
 * the larger of 5 ILS and 2% of the expense. The accountant can change this.
 */
export const MATCH_AMOUNT_ABS_ILS = 5
export const MATCH_AMOUNT_RATIO = 0.02

/** Invoice date and expense due date, either side. */
export const MATCH_DATE_WINDOW_DAYS = 21

export const DOC_TYPES = ['tax_invoice', 'receipt', 'other'] as const
export type InvoiceDocType = (typeof DOC_TYPES)[number]

export const DOCUMENT_STATUSES = ['uploaded', 'extracted', 'confirmed', 'rejected'] as const
export type ExpenseDocumentStatus = (typeof DOCUMENT_STATUSES)[number]

const EXT_MIME: Record<string, AllowedInvoiceMime> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
}

const MIME_EXT: Record<AllowedInvoiceMime, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

export function extensionForMime(mime: string): string {
  return MIME_EXT[mime as AllowedInvoiceMime] ?? 'bin'
}

/**
 * Browsers on phones often send an empty type or application/octet-stream for HEIC.
 * The extension is then the only signal. Anything else is rejected.
 */
export function resolveInvoiceMime(filename: string, mimeType: string): AllowedInvoiceMime | null {
  const normalized = mimeType.toLowerCase().split(';')[0].trim()
  const mapped = normalized === 'image/jpg' ? 'image/jpeg' : normalized
  if ((ALLOWED_INVOICE_MIME as readonly string[]).includes(mapped)) {
    return mapped as AllowedInvoiceMime
  }
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const fromExt = EXT_MIME[ext]
  if (!fromExt) return null
  if (mapped === '' || mapped === 'application/octet-stream') return fromExt
  return null
}

export function safeOriginalFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? 'invoice'
  const cleaned = base.replace(/[\u0000-\u001f]/g, '').trim()
  return (cleaned || 'invoice').slice(0, 200)
}
