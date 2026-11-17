import type { InvoiceDocType } from '@/lib/tazrim/expense-invoices/constants'
import {
  digitsOnly,
  isInvoiceDocType,
  normalizeInvoiceNumber,
} from '@/lib/tazrim/expense-invoices/validate'

/**
 * Invoice reading behind one function. The implementation is Gemini 2.5 Flash,
 * already used by the CRM (`GEMINI_API_KEY`, `lib/ai/client.ts`). No other
 * provider is called. Nothing from the document or the model's text is logged.
 */
export interface InvoiceExtraction {
  supplierName: string | null
  supplierTaxId: string | null
  invoiceNumber: string | null
  invoiceDate: string | null
  docType: InvoiceDocType
  currency: string
  netAmount: number | null
  vatRate: number | null
  vatAmount: number | null
  totalAmount: number | null
  allocationNumber: string | null
  confidence: number | null
  unavailable: boolean
  /** The printed document does not contain the words חשבונית מס. Stored on the invoice extraction. */
  taxInvoiceWordsAbsent: boolean
  /** The seller עוסק / ח.פ. number is not on the document. Stored on the invoice extraction. */
  sellerTaxIdAbsent: boolean
  /** Set when a HEIC/HEIF file could not be turned into JPEG. Nothing else is logged. */
  failure: 'heic_unreadable' | null
}

export interface ExtractInvoiceInput {
  bytes: Uint8Array
  mimeType: string
}

export interface ExtractInvoiceDeps {
  fetch?: typeof fetch
}

const MODEL = () => process.env.GEMINI_INVOICE_MODEL?.trim() || 'gemini-2.5-flash'

export const INVOICE_READ_PROMPT = [
  'Read this Israeli supplier document.',
  'It may be a tax invoice (חשבונית מס), a tax invoice receipt (חשבונית מס קבלה),',
  'a store, gas-station or other till document that prints a VAT amount without those words, or a plain receipt (קבלה).',
  'Reply with JSON only, no markdown, using exactly these keys:',
  'supplierName, supplierTaxId, invoiceNumber, invoiceDate (YYYY-MM-DD),',
  'docType (tax_invoice, receipt, or other — your reading of the title, before the rules below),',
  'mentionsTaxInvoiceWords (boolean: true only when the printed page contains the words חשבונית מס, including inside חשבונית מס קבלה),',
  'taxInvoiceReceipt (boolean: true when the document is חשבונית מס קבלה),',
  'currency (ISO code, ILS if shekel),',
  'netAmount, vatRate (percent, number), vatAmount, totalAmount, allocationNumber, confidence (0 to 1).',
  'supplierTaxId is the seller עוסק, ח.פ. or ע.מ., digits only.',
  'allocationNumber is מספר הקצאה, or null when it is not printed.',
  'חשבונית מס קבלה is always a tax invoice.',
  'A document that shows a VAT amount and the seller עוסק number is a tax invoice even when the words חשבונית מס are not printed.',
  'Use null for any field you cannot see. Do not invent a tax id, a VAT amount, or the words חשבונית מס.',
].join(' ')

const PROMPT = INVOICE_READ_PROMPT

export function emptyExtraction(): InvoiceExtraction {
  return {
    supplierName: null,
    supplierTaxId: null,
    invoiceNumber: null,
    invoiceDate: null,
    docType: 'other',
    currency: 'ILS',
    netAmount: null,
    vatRate: null,
    vatAmount: null,
    totalAmount: null,
    allocationNumber: null,
    confidence: null,
    unavailable: true,
    taxInvoiceWordsAbsent: false,
    sellerTaxIdAbsent: false,
    failure: null,
  }
}

export interface ClassifiedSupplierDocument {
  docType: InvoiceDocType
  taxInvoiceWordsAbsent: boolean
  sellerTaxIdAbsent: boolean
}

/** VAT plus the seller's עוסק number is a tax invoice. חשבונית מס קבלה always is. */
export function classifySupplierDocument(input: {
  modelDocType: InvoiceDocType
  vatAmount: number | null
  supplierTaxId: string | null
  mentionsTaxInvoiceWords: boolean | null
  taxInvoiceReceipt: boolean
}): ClassifiedSupplierDocument {
  const sellerTaxIdAbsent = !input.supplierTaxId
  const vatPresent = input.vatAmount !== null && input.vatAmount !== 0
  let docType: InvoiceDocType = input.modelDocType
  if (input.taxInvoiceReceipt || (vatPresent && !sellerTaxIdAbsent)) docType = 'tax_invoice'
  const taxInvoiceWordsAbsent = input.taxInvoiceReceipt ? false : input.mentionsTaxInvoiceWords === false
  return { docType, taxInvoiceWordsAbsent, sellerTaxIdAbsent }
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/,/g, ''))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function asDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  const dmy = text.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  if (!dmy) return null
  const day = dmy[1].padStart(2, '0')
  const month = dmy[2].padStart(2, '0')
  return `${dmy[3]}-${month}-${day}`
}

export function parseInvoiceModelJson(raw: string): InvoiceExtraction {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return emptyExtraction()
  }
  if (!parsed || typeof parsed !== 'object') return emptyExtraction()
  const row = parsed as Record<string, unknown>
  const modelDocType = typeof row.docType === 'string' && isInvoiceDocType(row.docType) ? row.docType : 'other'
  const confidence = asNumber(row.confidence)
  const tax = typeof row.supplierTaxId === 'string' ? digitsOnly(row.supplierTaxId) : ''
  const number = typeof row.invoiceNumber === 'string' ? normalizeInvoiceNumber(row.invoiceNumber) : ''
  const allocation = typeof row.allocationNumber === 'string' ? row.allocationNumber.trim() : ''
  const vatAmount = asNumber(row.vatAmount)
  const classified = classifySupplierDocument({
    modelDocType,
    vatAmount,
    supplierTaxId: tax || null,
    mentionsTaxInvoiceWords: typeof row.mentionsTaxInvoiceWords === 'boolean' ? row.mentionsTaxInvoiceWords : null,
    taxInvoiceReceipt: row.taxInvoiceReceipt === true,
  })
  return {
    supplierName: typeof row.supplierName === 'string' && row.supplierName.trim() ? row.supplierName.trim() : null,
    supplierTaxId: tax || null,
    invoiceNumber: number || null,
    invoiceDate: asDate(row.invoiceDate),
    docType: classified.docType,
    taxInvoiceWordsAbsent: classified.taxInvoiceWordsAbsent,
    sellerTaxIdAbsent: classified.sellerTaxIdAbsent,
    currency: typeof row.currency === 'string' && row.currency.trim() ? row.currency.trim().toUpperCase() : 'ILS',
    netAmount: asNumber(row.netAmount),
    vatRate: asNumber(row.vatRate),
    vatAmount: asNumber(row.vatAmount),
    totalAmount: asNumber(row.totalAmount),
    allocationNumber: allocation || null,
    confidence: confidence === null ? null : Math.min(1, Math.max(0, confidence)),
    unavailable: false,
    failure: null,
  }
}

/**
 * HEIC/HEIF is not offered in the upload dialog (iOS sends JPEG).
 * If a HEIC file still arrives, convert it with sharp. The default sharp
 * binary on Vercel is built without HEVC, so this often fails there: the
 * caller then shows heic_unreadable and does not send the file to the model.
 */
export async function prepareInvoiceBytes(
  bytes: Uint8Array,
  mimeType: string,
): Promise<{ ok: true; bytes: Uint8Array; mimeType: string } | { ok: false; error: 'heic_unreadable' }> {
  if (mimeType !== 'image/heic' && mimeType !== 'image/heif') return { ok: true, bytes, mimeType }
  try {
    const sharp = (await import('sharp')).default
    const jpeg = await sharp(Buffer.from(bytes)).rotate().jpeg({ quality: 85 }).toBuffer()
    return { ok: true, bytes: new Uint8Array(jpeg), mimeType: 'image/jpeg' }
  } catch {
    return { ok: false, error: 'heic_unreadable' }
  }
}

export async function extractInvoice(
  input: ExtractInvoiceInput,
  deps: ExtractInvoiceDeps = {},
): Promise<InvoiceExtraction> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) return emptyExtraction()

  const prepared = await prepareInvoiceBytes(input.bytes, input.mimeType)
  if (!prepared.ok) return { ...emptyExtraction(), failure: 'heic_unreadable' }
  const fetchImpl = deps.fetch ?? fetch
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL()}:generateContent?key=${apiKey}`

  let response: Response
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: PROMPT },
              {
                inline_data: {
                  mime_type: prepared.mimeType,
                  data: Buffer.from(prepared.bytes).toString('base64'),
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
        },
      }),
    })
  } catch {
    console.error('[tazrim] invoice extract request failed')
    return emptyExtraction()
  }

  if (!response.ok) {
    console.error('[tazrim] invoice extract failed', { status: response.status })
    return emptyExtraction()
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    console.error('[tazrim] invoice extract returned a non-json response')
    return emptyExtraction()
  }

  const text = readModelText(payload)
  if (!text) return emptyExtraction()
  return parseInvoiceModelJson(text)
}

function readModelText(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const candidates = (payload as { candidates?: unknown }).candidates
  if (!Array.isArray(candidates) || candidates.length === 0) return null
  const parts = (candidates[0] as { content?: { parts?: Array<{ text?: string }> } }).content?.parts
  if (!Array.isArray(parts)) return null
  const text = parts.map((part) => part.text ?? '').join('')
  return text.trim() ? text : null
}
