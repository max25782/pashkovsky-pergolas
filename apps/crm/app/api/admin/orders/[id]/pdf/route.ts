/**
 * Order PDF API Route
 * Generates PDF for an order
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAuth } from '@/lib/middleware/require-company-auth'
import { profilesApi } from '@/lib/profiles-api/client'
import { generateOrderPdf, generateOrderPdfFilename } from '@/lib/pdf/generate-order-pdf'
import { uploadToS3 } from '@/lib/s3-upload'

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
  { params }: { params: { id: string } },
) {
  const auth = await requireCompanyAuth(req)
  if (!auth.ok) return auth.error

  try {
    const orderResult = await profilesApi.orders.get(params.id, auth.companyId, auth.authHeader)
    if (!orderResult.ok) {
      const msg = (orderResult.data as { message?: string })?.message || 'Failed to fetch order'
      console.error('[PDF API] Profiles API returned error:', orderResult.status, msg)
      return NextResponse.json({ error: msg }, { status: orderResult.status })
    }

    const order = orderResult.data

    let pdfBuffer: Buffer
    try {
      pdfBuffer = await generateOrderPdf(order)
    } catch (pdfErr: unknown) {
      const msg = pdfErr instanceof Error ? pdfErr.message : 'Unknown PDF error'
      console.error('[PDF API] PDF generation failed:', msg)
      return NextResponse.json({ error: `PDF generation failed: ${msg}` }, { status: 500 })
    }

    const filename = generateOrderPdfFilename(order)
    const key = `orders/${(order as { id: string }).id}/${filename}`
    const pdfUrl = await uploadToS3(pdfBuffer, key, 'application/pdf')

    return NextResponse.json({ pdfUrl, cached: false })
  } catch (error: unknown) {
    const msg = (error instanceof Error ? error.message : String(error)) || 'Internal server error'
    console.error('[PDF API] Unexpected error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
