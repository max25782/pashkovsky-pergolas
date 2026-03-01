/**
 * Order PDF API Route
 * Generates PDF for an order
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { generateOrderPdf, generateOrderPdfFilename } from '@/lib/pdf/generate-order-pdf'
import { uploadToS3 } from '@/lib/s3-upload'

const PROFILES_API_URL = process.env.PROFILES_API_URL || 'http://localhost:3002'
const UPSTREAM_TIMEOUT_MS = 8000

// Force Node.js runtime (not Edge) for Puppeteer/Chromium compatibility
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

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
    let orderResponse: Response
    const orderUrl = `${PROFILES_API_URL}/orders/${id}?company_id=${companyId}`
    try {
      orderResponse = await fetch(orderUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      })
    } catch (fetchErr: any) {
      const msg = fetchErr?.message || 'fetch failed'
      console.error('[PDF API] Failed to reach Profiles API:', msg, { url: orderUrl })
      return NextResponse.json(
        { error: `Cannot reach Profiles API (${msg}). Check PROFILES_API_URL in Vercel env.` },
        { status: 502 }
      )
    }

    if (!orderResponse.ok) {
      const body = await orderResponse.json().catch(() => ({ message: 'Failed to fetch order' }))
      console.error('[PDF API] Profiles API returned error:', orderResponse.status, body)
      return NextResponse.json(
        { error: body.message || `Profiles API error ${orderResponse.status}` },
        { status: orderResponse.status }
      )
    }

    const order = await orderResponse.json()
    console.log('[PDF API] Order fetched, generating PDF...')

    let pdfBuffer: Buffer
    try {
      pdfBuffer = await generateOrderPdf(order)
      console.log('[PDF API] PDF buffer generated, size:', pdfBuffer.length)
    } catch (pdfErr: any) {
      const msg = pdfErr?.message || 'Unknown PDF error'
      console.error('[PDF API] PDF generation failed:', msg)
      return NextResponse.json(
        { error: `PDF generation failed: ${msg}` },
        { status: 500 }
      )
    }

    const filename = generateOrderPdfFilename(order)
    const key = `orders/${order.id}/${filename}`

    console.log('[PDF API] Uploading PDF to S3:', key)
    const pdfUrl = await uploadToS3(pdfBuffer, key, 'application/pdf')
    console.log('[PDF API] PDF uploaded to S3:', pdfUrl)

    return NextResponse.json({ pdfUrl, cached: false })
  } catch (error: any) {
    const msg = error?.message || 'Internal server error'
    console.error('[PDF API] Unexpected error:', msg)
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    )
  }
}
