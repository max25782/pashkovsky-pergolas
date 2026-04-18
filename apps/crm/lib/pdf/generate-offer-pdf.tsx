import type { Offer } from '@/types/offer'
import { renderOfferHtml } from './offer-html-template'
import { renderHtmlToPdfBuffer } from './render-html-to-pdf'

/**
 * Fetches an external image URL and returns it as a base64 data URL.
 * Puppeteer renders HTML from about:blank and cannot load external URLs,
 * so images must be inlined as data URLs before PDF generation.
 */
async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') ?? 'image/png'
    const arrayBuffer = await res.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    return `data:${contentType};base64,${base64}`
  } catch {
    return null
  }
}

/**
 * Resolves the 3D preview image for the offer as a base64 data URL.
 * Tries configuratorMeta.previewImageUrl first, then offer.images[0].
 */
async function resolvePreviewImageDataUrl(offer: Offer): Promise<string | null> {
  const url = offer.configuratorMeta?.previewImageUrl ?? offer.images?.[0]
  if (!url?.startsWith('http')) return null
  return fetchImageAsDataUrl(url)
}

/**
 * Generates a PDF buffer for the given offer using Puppeteer + Chromium
 * with proper Hebrew RTL support
 * @param offer - The offer to generate PDF for
 * @returns PDF as Buffer
 */
export async function generateOfferPdf(offer: Offer, locale?: string): Promise<Buffer> {
  try {
    // Pre-fetch the 3D preview image as a base64 data URL so Puppeteer can
    // render it inline without needing external network access.
    const previewImageDataUrl = await resolvePreviewImageDataUrl(offer)

    // Render HTML template with inlined image
    const html = renderOfferHtml(offer, previewImageDataUrl, false, locale)
    
    // Convert HTML to PDF
    const pdfBuffer = await renderHtmlToPdfBuffer(html)
    
    return pdfBuffer
  } catch (error: unknown) {
    const e = error instanceof Error ? error : null
    console.error('[PDF Generator] ==========================================')
    console.error('[PDF Generator] ERROR generating PDF:')
    console.error('[PDF Generator] Message:', e?.message)
    console.error('[PDF Generator] Stack:', e?.stack)
    console.error('[PDF Generator] ==========================================')
    throw new Error(`Failed to generate PDF: ${e?.message || 'Unknown error'}`)
  }
}

/**
 * Generate filename for offer PDF
 * @param offer - The offer object
 * @returns string - formatted filename
 */
export function generateOfferPdfFilename(offer: Offer): string {
  const date = new Date(offer.createdAt).toISOString().split('T')[0]
  const customerName = offer.customerName.replace(/[^a-zA-Z0-9א-ת]/g, '_')
  return `offer_${offer.id}_${customerName}_${date}.pdf`
}
