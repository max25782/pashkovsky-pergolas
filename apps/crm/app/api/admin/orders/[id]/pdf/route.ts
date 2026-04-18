/**
 * Order PDF API Route
 * Generates PDF for an order
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireCompanyAuth } from '@/lib/middleware/require-company-auth'
import { profilesApi } from '@/lib/profiles-api/client'
import { generateOrderPdf, generateOrderPdfFilename } from '@/lib/pdf/generate-order-pdf'
import { fetchCompanyPdfLocale, mergeUiPdfLocale } from '@/lib/pdf/company-pdf-locale'
import type { PdfLocale } from '@/lib/pdf/pdf-locale'
import { uploadToS3 } from '@/lib/s3-upload'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase =
  SUPABASE_URL && SERVICE_KEY
    ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
    : undefined

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
    const { searchParams } = new URL(req.url)
    const localeParam = searchParams.get('locale')

    const orderResult = await profilesApi.orders.get(params.id, auth.companyId, auth.authHeader)
    if (!orderResult.ok) {
      const msg = (orderResult.data as { message?: string })?.message || 'Failed to fetch order'
      console.error('[PDF API] Profiles API returned error:', orderResult.status, msg)
      return NextResponse.json({ error: msg }, { status: orderResult.status })
    }

    const order = orderResult.data as Parameters<typeof generateOrderPdf>[0]

    let companyLocale: PdfLocale = 'he'
    if (supabase) {
      companyLocale = await fetchCompanyPdfLocale(supabase, auth.companyId)
    }
    const pdfLocale = mergeUiPdfLocale(localeParam, companyLocale)

    let pdfBuffer: Buffer
    try {
      pdfBuffer = await generateOrderPdf(order, pdfLocale)
    } catch (pdfErr: unknown) {
      const msg = pdfErr instanceof Error ? pdfErr.message : 'Unknown PDF error'
      console.error('[PDF API] PDF generation failed:', msg)
      return NextResponse.json({ error: `PDF generation failed: ${msg}` }, { status: 500 })
    }

    const filename = generateOrderPdfFilename(order)
    const key = `orders/${order.id}/${filename}`
    const pdfUrl = await uploadToS3(pdfBuffer, key, 'application/pdf')

    return NextResponse.json({ pdfUrl, cached: false })
  } catch (error: unknown) {
    const msg = (error instanceof Error ? error.message : String(error)) || 'Internal server error'
    console.error('[PDF API] Unexpected error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
