import type { Offer } from '@/types/offer'
import { renderOfferHtml } from './offer-html-template'
import { renderHtmlToPdfBuffer } from './render-html-to-pdf'

/**
 * Generates a PDF buffer for the given offer using Puppeteer + Chromium
 * with proper Hebrew RTL support
 * @param offer - The offer to generate PDF for
 * @returns PDF as Buffer
 */
export async function generateOfferPdf(offer: Offer): Promise<Buffer> {
  try {
    
    // Render HTML template
    const html = renderOfferHtml(offer)
    
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
