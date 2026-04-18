import { renderOrderHtml } from './order-html-template'
import { renderHtmlToPdfBuffer } from './render-html-to-pdf'

interface Order {
  id: string
  order_number: string
  customer_name: string
  customer_phone: string
  customer_email: string
  customer_city: string
  status: string
  total_weight_kg: number
  total_amount: number
  final_amount: number
  discount_percent?: number
  discount_amount?: number
  delivery_address?: string
  delivery_date?: string
  notes?: string
  customer_notes?: string
  created_at: string
  order_items: Array<{
    id: string
    profile_id: string
    color: string
    length_meters: number
    quantity_pieces: number
    weight_per_piece: number
    total_weight_kg: number
    price_per_piece: number
    subtotal: number
    aluminum_profiles?: {
      code: string
      name_he: string
      image_url?: string
    }
  }>
}

/**
 * Fetch a remote image URL and return a base64 data URI.
 * Returns empty string on any error so the PDF generation never fails.
 */
async function fetchImageBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!response.ok) return ''
    const buffer = await response.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    return `data:${contentType};base64,${base64}`
  } catch {
    return ''
  }
}

/**
 * Prefetch all unique product images from order items in parallel.
 * Returns a map of image_url → base64 data URI.
 */
async function prefetchImages(order: Order): Promise<Record<string, string>> {
  const urls = new Set<string>()
  for (const item of order.order_items ?? []) {
    const url = item.aluminum_profiles?.image_url
    if (url) urls.add(url)
  }

  const entries = await Promise.all(
    Array.from(urls).map(async (url) => [url, await fetchImageBase64(url)] as const)
  )

  return Object.fromEntries(entries.filter(([, b64]) => b64))
}

/**
 * Generates a PDF buffer for the given order using Puppeteer + Chromium
 * with proper Hebrew RTL support and embedded product images.
 */
export async function generateOrderPdf(order: Order, locale?: string): Promise<Buffer> {
  try {

    const imageMap = await prefetchImages(order)

    const html = renderOrderHtml(order, imageMap, locale)

    const pdfBuffer = await renderHtmlToPdfBuffer(html)

    return pdfBuffer
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[PDF Generator] ERROR:', msg)
    throw new Error(`Failed to generate PDF: ${msg || 'Unknown error'}`)
  }
}

export function generateOrderPdfFilename(order: Order): string {
  const customerName = order.customer_name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20)
  const date = new Date().toISOString().split('T')[0]
  return `order_${order.order_number}_${customerName}_${date}.pdf`
}
