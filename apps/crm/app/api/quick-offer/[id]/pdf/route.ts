/**
 * POST /api/quick-offer/[id]/pdf
 *
 * Generates a PDF for a quick offer and returns it as a binary stream.
 * Does NOT require S3 upload — streams directly to the client for immediate download.
 * This keeps the "Download PDF without saving to CRM" flow fast and self-contained.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { generateOfferPdf } from '@/lib/pdf/generate-offer-pdf'
import { fetchPdfLocaleForOffer } from '@/lib/pdf/company-pdf-locale'
import type { Offer } from '@/types/offer'
import { pergolaFieldsFromOfferRow } from '@/lib/pdf/map-offer-db-row-for-pdf'

export const runtime = 'nodejs'
export const maxDuration = 60

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase =
  SUPABASE_URL && SERVICE_KEY
    ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
    : undefined

async function fetchOffer(id: string): Promise<Offer | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('offers').select('*').eq('id', id).single()
  if (error || !data) return null

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
    color: { type: data.color_type, ralCode: data.color_ral_code, woodName: data.color_wood_name },
    roof: { type: data.roof_type, santafColor: data.roof_santaf_color },
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
    options: { notes: data.options_notes },
    area: data.area,
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
    pdf: { url: data.pdf_url, createdAt: data.pdf_created_at },
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuthAsync(req)
  if (!auth.authorized) return auth.error

  if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  try {
    const offer = await fetchOffer(params.id)
    if (!offer) return NextResponse.json({ error: 'Offer not found' }, { status: 404 })

    const pdfLocale = await fetchPdfLocaleForOffer(supabase, params.id)
    const pdfBuffer = await generateOfferPdf(offer, pdfLocale)
    const filename = `offer_${offer.id}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    console.error('[quick-offer/pdf]', e)
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
