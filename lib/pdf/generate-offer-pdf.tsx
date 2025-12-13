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
    console.log('[PDF Generator] ==========================================')
    console.log('[PDF Generator] Starting PDF generation for offer:', offer.id)
    console.log('[PDF Generator] Customer:', offer.customerName)
    
    // Render HTML template
    console.log('[PDF Generator] Step 1: Rendering HTML template...')
    const html = renderOfferHtml(offer)
    console.log('[PDF Generator] ✅ HTML template rendered, length:', html.length)
    
    // Convert HTML to PDF
    console.log('[PDF Generator] Step 2: Converting HTML to PDF...')
    const pdfBuffer = await renderHtmlToPdfBuffer(html)
    console.log('[PDF Generator] ✅ PDF generated successfully, size:', pdfBuffer.length, 'bytes')
    console.log('[PDF Generator] ==========================================')
    
    return pdfBuffer
  } catch (error: any) {
    console.error('[PDF Generator] ==========================================')
    console.error('[PDF Generator] ❌ ERROR generating PDF:')
    console.error('[PDF Generator] Message:', error?.message)
    console.error('[PDF Generator] Stack:', error?.stack)
    console.error('[PDF Generator] ==========================================')
    throw new Error(`Failed to generate PDF: ${error.message || 'Unknown error'}`)
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
