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
    }
  }>
}

/**
 * Generates a PDF buffer for the given order using Puppeteer + Chromium
 * with proper Hebrew RTL support
 * @param order - The order to generate PDF for
 * @returns PDF as Buffer
 */
export async function generateOrderPdf(order: Order): Promise<Buffer> {
  try {
    console.log('[PDF Generator] Starting PDF generation for order:', order.id)
    console.log('[PDF Generator] Order number:', order.order_number)
    console.log('[PDF Generator] Customer:', order.customer_name)
    
    // Render HTML template
    console.log('[PDF Generator] Step 1: Rendering HTML template...')
    const html = renderOrderHtml(order)
    console.log('[PDF Generator] ✅ HTML template rendered, length:', html.length)
    
    // Convert HTML to PDF
    console.log('[PDF Generator] Step 2: Converting HTML to PDF...')
    const pdfBuffer = await renderHtmlToPdfBuffer(html)
    console.log('[PDF Generator] ✅ PDF generated successfully, size:', pdfBuffer.length, 'bytes')
    
    return pdfBuffer
  } catch (error: any) {
    console.error('[PDF Generator] ❌ ERROR generating PDF:')
    console.error('[PDF Generator] Message:', error?.message)
    console.error('[PDF Generator] Stack:', error?.stack)
    throw new Error(`Failed to generate PDF: ${error.message || 'Unknown error'}`)
  }
}

/**
 * Generate filename for order PDF
 * @param order - The order object
 * @returns string - formatted filename
 */
export function generateOrderPdfFilename(order: Order): string {
  const customerName = order.customer_name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20)
  const date = new Date().toISOString().split('T')[0]
  return `order_${order.order_number}_${customerName}_${date}.pdf`
}
