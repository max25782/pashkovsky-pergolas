import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateOfferPdf, generateOfferPdfFilename } from '@/lib/pdf/generate-offer-pdf'
import { fetchPdfLocaleForOffer, mergeUiPdfLocale } from '@/lib/pdf/company-pdf-locale'
import type { PdfLocale } from '@/lib/pdf/pdf-locale'
import { uploadToS3 } from '@/lib/s3-upload'
import type { Offer } from '@/types/offer'
import { transformOfferFromDbRow } from '@/lib/pdf/map-offer-db-row-for-pdf'

// Force Node.js runtime (not Edge) for Puppeteer/Chromium compatibility
export const runtime = 'nodejs'

// Increase timeout for PDF generation (Vercel default is 10s for Hobby, 60s for Pro)
export const maxDuration = 60 // seconds

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

async function fetchOffer(id: string): Promise<Offer | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('offers').select('*').eq('id', id).single()
  if (error || !data) {
    console.error('PDF: offer not found', error)
    return null
  }
  return transformOfferFromDbRow(data as Record<string, unknown>)
}

// POST - Generate PDF for offer
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Server not configured' },
      { status: 500 }
    )
  }

  try {
    // Check for force regeneration parameter
    const { searchParams } = new URL(req.url)
    const force = searchParams.get('force') === 'true'
    const localeParam = searchParams.get('locale')

    const offer = await fetchOffer(params.id)
    if (!offer) {
      console.error('[PDF API] Offer not found:', params.id)
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
    }

    const companyLocale = await fetchPdfLocaleForOffer(supabase, offer.id)
    const pdfLocale = mergeUiPdfLocale(localeParam, companyLocale)
    const storedLocale = (offer.pdf?.locale as PdfLocale | undefined) ?? 'he'

    const pdfCreatedAt = offer.pdf?.createdAt
    const offerUpdatedAt = offer.updatedAt
    const pdfIsStale =
      pdfCreatedAt != null &&
      offerUpdatedAt != null &&
      new Date(offerUpdatedAt).getTime() > new Date(pdfCreatedAt).getTime()

    if (offer.pdf?.url && !force && !pdfIsStale && storedLocale === pdfLocale) {
      return NextResponse.json({
        pdfUrl: offer.pdf.url,
        cached: true,
        message: 'PDF already exists. Use ?force=true to regenerate.',
      })
    }

    const pdfBuffer = await generateOfferPdf(offer, pdfLocale)

    const filename = generateOfferPdfFilename(offer)
    const key = `offers/${offer.id}/${filename}`

    const pdfUrl = await uploadToS3(pdfBuffer, key, 'application/pdf')

    await supabase
      .from('offers')
      .update({
        pdf_url: pdfUrl,
        pdf_created_at: new Date().toISOString(),
        pdf_locale: pdfLocale,
      })
      .eq('id', offer.id)

    return NextResponse.json({ pdfUrl, cached: false })
  } catch (error: unknown) {
    const err = error as Error & { constructor?: { name?: string }; stack?: string }
    console.error('[PDF API] ==========================================')
    console.error('[PDF API] ERROR generating PDF:')
    console.error('[PDF API] Error type:', err?.constructor?.name || typeof error)
    console.error('[PDF API] Error message:', err instanceof Error ? err.message : String(error))
    console.error('[PDF API] Error stack:', err?.stack || 'No stack trace')
    console.error('[PDF API] ==========================================')
    
    // Provide more helpful error messages
    let errorMessage = err instanceof Error ? err.message : String(error)
    if (errorMessage.includes('Failed to launch browser') || errorMessage.includes('Failed to launch Puppeteer')) {
      errorMessage = 'Не удалось запустить браузер для генерации PDF. Убедитесь, что Puppeteer установлен правильно.'
    } else if (errorMessage.includes('Failed to render PDF')) {
      errorMessage = 'Не удалось преобразовать HTML в PDF. Проверьте содержимое предложения.'
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to generate PDF', 
        details: errorMessage,
        originalError: process.env.NODE_ENV === 'development' && err instanceof Error ? err.message : undefined
      },
      { status: 500 }
    )
  }
}

// GET - Download existing PDF
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Server not configured' },
      { status: 500 }
    )
  }

  try {
    const { data, error } = await supabase
      .from('offers')
      .select('pdf_url')
      .eq('id', params.id)
      .single()

    if (error || !data?.pdf_url) {
      return NextResponse.json(
        { error: 'PDF not found' },
        { status: 404 }
      )
    }

    // Redirect to S3 URL
    return NextResponse.redirect(data.pdf_url)
  } catch (error: unknown) {
    console.error('Error fetching PDF:', error)
    return NextResponse.json(
      { error: 'Failed to fetch PDF' },
      { status: 500 }
    )
  }
}
