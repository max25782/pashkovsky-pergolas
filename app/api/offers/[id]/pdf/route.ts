import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateOfferPdf, generateOfferPdfFilename } from '@/lib/pdf/generate-offer-pdf'
import { uploadToS3 } from '@/lib/s3-upload'
import type { Offer, PergolaShape } from '@/types/offer'

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

  return {
    id: data.id,
    dealId: data.deal_id,
    customerName: data.customer_name,
    customerPhone: data.customer_phone,
    customerCity: data.customer_city,

    pergola: {
      // New shape-based structure
      shape: data.pergola_shape_data 
        ? (data.pergola_shape_data as PergolaShape)
        : {
            // Fallback to legacy format if shape_data is missing
            type: 'rectangle' as const,
            width: data.pergola_width || 0,
            length: data.pergola_length || 0,
          },
      height: data.pergola_height,
      location: data.pergola_location,
      pricePerSqm: data.pergola_price_per_sqm,
      // Legacy fields for backward compatibility
      width: data.pergola_width,
      length: data.pergola_length,
    },
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
      type: data.winter_closure_type,
      glassType: data.winter_closure_glass_type,
    },
    options: {
      notes: data.options_notes,
    },
    discountPercent: data.discount_percent,

    area: data.area,
    pergolaTotal: data.pergola_total,
    santafTotal: data.santaf_total,
    zipScreenTotal: data.zip_screen_total,
    lightingTotal: data.lighting_total,
    drainageTotal: data.drainage_total,
    totalBeforeVat: data.total_before_vat,
    vatAmount: data.vat_amount,
    priceWithVat: data.price_with_vat,
    discountAmount: data.discount_amount,
    finalPrice: data.final_price,

    pricing: {
      pergolaTotal: data.pergola_total,
      santafTotal: data.santaf_total,
      zipScreenTotal: data.zip_screen_total,
      lightingTotal: data.lighting_total,
      drainageTotal: data.drainage_total,
      totalBeforeVat: data.total_before_vat,
      vatPercent: data.vat_percent,
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

  try {
    // Check for force regeneration parameter
    const { searchParams } = new URL(req.url)
    const force = searchParams.get('force') === 'true'

    console.log('[PDF API] PDF generation started for offer:', params.id, force ? '(forced)' : '')
    
    const offer = await fetchOffer(params.id)
    if (!offer) {
      console.error('[PDF API] Offer not found:', params.id)
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
    }

    // If PDF already exists and not forcing regeneration, return existing URL
    if (offer.pdf?.url && !force) {
      console.log('[PDF API] PDF already exists, returning cached URL:', offer.pdf.url)
      return NextResponse.json({ 
        pdfUrl: offer.pdf.url,
        cached: true,
        message: 'PDF already exists. Use ?force=true to regenerate.'
      })
    }

    console.log('[PDF API] Generating PDF buffer...')
    const pdfBuffer = await generateOfferPdf(offer)
    console.log('[PDF API] PDF buffer generated, size:', pdfBuffer.length)

    const filename = generateOfferPdfFilename(offer)
    const key = `offers/${offer.id}/${filename}`

    console.log('[PDF API] Uploading PDF to S3:', key)
    const pdfUrl = await uploadToS3(pdfBuffer, key, 'application/pdf')
    console.log('[PDF API] PDF uploaded to S3:', pdfUrl)

    await supabase
      .from('offers')
      .update({ pdf_url: pdfUrl, pdf_created_at: new Date().toISOString() })
      .eq('id', offer.id)

    console.log('[PDF API] PDF URL saved to database')
    return NextResponse.json({ pdfUrl, cached: false })
  } catch (error: any) {
    console.error('[PDF API] Error generating PDF:', error)
    console.error('[PDF API] Error stack:', error?.stack)
    console.error('[PDF API] Error message:', error?.message)
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: error?.message || 'Unknown error' },
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
  } catch (error: any) {
    console.error('Error fetching PDF:', error)
    return NextResponse.json(
      { error: 'Failed to fetch PDF', details: error.message },
      { status: 500 }
    )
  }
}
