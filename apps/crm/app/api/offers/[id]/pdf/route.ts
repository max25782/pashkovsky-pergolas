import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateOfferPdf, generateOfferPdfFilename } from '@/lib/pdf/generate-offer-pdf'
import { fetchPdfLocaleForOffer, mergeUiPdfLocale } from '@/lib/pdf/company-pdf-locale'
import type { PdfLocale } from '@/lib/pdf/pdf-locale'
import { uploadToS3 } from '@/lib/s3-upload'
import type { Offer } from '@/types/offer'
import { pergolaFieldsFromOfferRow } from '@/lib/pdf/map-offer-db-row-for-pdf'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

// 30 PDF generations per IP per hour (Puppeteer is CPU-intensive)
const PDF_RATE_LIMIT = { maxRequests: 30, windowMs: 60 * 60 * 1000 }

// Force Node.js runtime (not Edge) for Puppeteer/Chromium compatibility
export const runtime = 'nodejs'

// Increase timeout for PDF generation (Vercel default is 10s for Hobby, 60s for Pro)
export const maxDuration = 60 // seconds

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

// Fetch offer from DB and map to Offer type (minimal for PDF)
async function fetchOffer(id: string): Promise<Offer | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('offers').select('*').eq('id', id).single()
  if (error || !data) {
    console.error('PDF: offer not found', error)
    return null
  }

  // Log raw shape data for debugging

  const pf = pergolaFieldsFromOfferRow(data)

  return {
    id: data.id,
    dealId: data.deal_id,
    customerName: data.customer_name,
    customerPhone: data.customer_phone,
    customerCity: data.customer_city,

    pergolas: pf.pergolas,
    pergola: pf.pergola,
    quickProduct: pf.quickProduct,
    quickRailings: pf.quickRailings,
    quickFence: pf.quickFence,
    quickOfferExtra: pf.quickOfferExtra,

    configuratorMeta: data.configurator_meta ?? undefined,
    color: {
      type: data.color_type,
      ralCode: data.color_ral_code,
      woodName: data.color_wood_name,
    },
    roof: {
      type: data.roof_type,
      santafColor: data.roof_santaf_color,
    },
    shadingRatio: data.shading_ratio,
    finishType: data.finish_type,
    finishValue: data.finish_value,
    santaf: {
      enabled: data.santaf_enabled,
      withStructure: data.santaf_with_structure,
      pricePerSqmBasic: data.santaf_price_per_sqm_basic,
      pricePerSqmWithStructure: data.santaf_price_per_sqm_with_structure,
    },
    zipScreen: {
      enabled: data.zip_screen_enabled,
      type: data.zip_screen_type,
      pricePerSqmManual: data.zip_screen_price_per_sqm_manual,
      pricePerSqmElectric: data.zip_screen_price_per_sqm_electric,
      runningMeters: data.zip_screen_running_meters,
    },
    lighting: {
      enabled: data.lighting_enabled,
      pricePerMeter: data.lighting_price_per_meter,
      runningMeters: data.lighting_running_meters,
    },
    drainage: {
      enabled: data.drainage_enabled,
      pricePerMeter: data.drainage_price_per_meter,
      runningMeters: data.drainage_running_meters,
    },
    winterClosure: {
      enabled: data.winter_closure_enabled,
      items: data.winter_closure_items || [],
      glassType: data.winter_closure_glass_type,
    },
    options: {
      notes: data.options_notes,
    },

    area: data.area,
    pergolaTotal: data.pergola_total,
    railingsLineTotal: pf.quickOfferExtra?.railingsLineTotal,
    fenceLineTotal: pf.quickOfferExtra?.fenceLineTotal,
    santafTotal: data.santaf_total,
    zipScreenTotal: data.zip_screen_total,
    lightingTotal: data.lighting_total,
    drainageTotal: data.drainage_total,
    winterClosureTotal: data.winter_closure_total || 0,
    totalBeforeVat: data.total_before_vat,
    vatPercent: data.vat_percent || 18,
    vatAmount: data.vat_amount,
    priceWithVat: data.price_with_vat,
    discountPercent: data.discount_percent || 0,
    discountAmount: data.discount_amount,
    finalPrice: data.final_price,

    pricing: {
      pergolaTotal: data.pergola_total,
      santafTotal: data.santaf_total,
      zipScreenTotal: data.zip_screen_total,
      lightingTotal: data.lighting_total,
      drainageTotal: data.drainage_total,
      winterClosureTotal: data.winter_closure_total || 0,
      totalBeforeVat: data.total_before_vat,
      vatPercent: data.vat_percent || 18,
      vatAmount: data.vat_amount,
      priceWithVat: data.price_with_vat,
      discountPercent: data.discount_percent,
      discountAmount: data.discount_amount,
      finalPrice: data.final_price,
    },

    paymentTerms: data.payment_terms,
    warranty: data.warranty,
    images: data.images,

    approval: {
      approved: data.approved,
      approvedAt: data.approved_at,
      signatureImage: data.signature_image,
      customerName: data.approval_customer_name,
      customerPhone: data.approval_customer_phone,
    },
    pdf: {
      url: data.pdf_url,
      createdAt: data.pdf_created_at,
      locale: data.pdf_locale ?? undefined,
    },
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
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

  // Rate limit per IP to protect Puppeteer resources
  const ip = getClientIp(req)
  const rateLimitResult = checkRateLimit(`pdf-offer:${ip}`, PDF_RATE_LIMIT)
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many PDF requests. Try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)) },
      }
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

    if (offer.pdf?.url && !force && storedLocale === pdfLocale) {
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
      { error: 'Failed to generate PDF' },
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
