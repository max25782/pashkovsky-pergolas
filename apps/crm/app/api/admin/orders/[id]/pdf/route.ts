/**
 * Order PDF API Route
 * Generates PDF for an order
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { generateOrderPdf, generateOrderPdfFilename } from '@/lib/pdf/generate-order-pdf'
import { uploadToS3 } from '@/lib/s3-upload'

const PROFILES_API_URL = process.env.PROFILES_API_URL || 'http://localhost:3002'

// Force Node.js runtime (not Edge) for Puppeteer/Chromium compatibility
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/orders/[id]/pdf
 * Generate PDF for an order
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error

  const companyId = authCheck.context?.companyId
  if (!companyId) {
    return NextResponse.json({ error: 'Company ID not found' }, { status: 400 })
  }

  try {
    const { id } = params
    const authHeader = req.headers.get('authorization')

    // Fetch order from Profiles API
    const response = await fetch(`${PROFILES_API_URL}/orders/${id}?company_id=${companyId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch order' }))
      return NextResponse.json(
        { error: error.message || 'Failed to fetch order' },
        { status: response.status }
      )
    }

    const order = await response.json()

    console.log('[PDF API] Generating PDF buffer...')
    const pdfBuffer = await generateOrderPdf(order)
    console.log('[PDF API] PDF buffer generated, size:', pdfBuffer.length)

    const filename = generateOrderPdfFilename(order)
    const key = `orders/${order.id}/${filename}`

    console.log('[PDF API] Uploading PDF to S3:', key)
    const pdfUrl = await uploadToS3(pdfBuffer, key, 'application/pdf')
    console.log('[PDF API] PDF uploaded to S3:', pdfUrl)

    return NextResponse.json({ pdfUrl, cached: false })
  } catch (error: any) {
    console.error('[PDF API] ❌ ERROR generating PDF:')
    console.error('[PDF API] Error:', error)
    
    let errorMessage = error.message || 'Failed to generate PDF'
    if (errorMessage.includes('Failed to launch')) {
      errorMessage = 'Failed to launch browser for PDF generation. Make sure Puppeteer is installed correctly.'
    } else if (errorMessage.includes('Failed to render PDF')) {
      errorMessage = 'Failed to convert HTML to PDF. Check order content.'
    }

    return NextResponse.json(
      { error: 'Failed to generate PDF', details: errorMessage },
      { status: 500 }
    )
  }
}
