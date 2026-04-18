import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { renderOfferHtml } from '@/lib/pdf/offer-html-template'
import { fetchCompanyPdfLocale } from '@/lib/pdf/company-pdf-locale'
import { ApproveClient } from './ApproveClient'
import type { Offer, Pergola, PergolaShape } from '@/types/offer'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function transformOfferFromDB(data: Record<string, unknown>): Offer {
  const pergolasData = data.pergolas_data as Pergola[] | null | undefined
  const hasPergolasArray = Array.isArray(pergolasData) && pergolasData.length > 0

  let pergolaShape: PergolaShape
  if (data.pergola_shape_data) {
    pergolaShape = data.pergola_shape_data as PergolaShape
  } else {
    pergolaShape = {
      type: 'rectangle',
      width: (data.pergola_width as number) || 0,
      length: (data.pergola_length as number) || 0,
    }
  }

  const pergolaSingle = hasPergolasArray
    ? pergolasData![0]
    : {
        shape: pergolaShape,
        height: data.pergola_height as number | undefined,
        location: data.pergola_location as string | undefined,
        pricePerSqm: data.pergola_price_per_sqm as number | undefined,
        width: data.pergola_width as number | undefined,
        length: data.pergola_length as number | undefined,
      }

  return {
    id: data.id as string,
    dealId: data.deal_id as string | undefined,
    customerName: data.customer_name as string,
    customerPhone: data.customer_phone as string | undefined,
    customerCity: data.customer_city as string | undefined,

    pergolas: hasPergolasArray ? pergolasData : undefined,
    pergola: pergolaSingle,
    color: {
      type: data.color_type as string,
      ralCode: data.color_ral_code as string | undefined,
      woodName: data.color_wood_name as string | undefined,
    },
    roof: {
      type: data.roof_type as string,
      santafColor: data.roof_santaf_color as string | undefined,
    },
    shadingRatio: data.shading_ratio as string | undefined,
    finishType: data.finish_type as string | undefined,
    finishValue: data.finish_value as string | undefined,
    santaf: {
      enabled: data.santaf_enabled as boolean,
      withStructure: data.santaf_with_structure as boolean,
      pricePerSqmBasic: data.santaf_price_per_sqm_basic as number,
      pricePerSqmWithStructure: data.santaf_price_per_sqm_with_structure as number,
    },
    zipScreen: {
      enabled: data.zip_screen_enabled as boolean,
      type: data.zip_screen_type as string,
      pricePerSqmManual: data.zip_screen_price_per_sqm_manual as number,
      pricePerSqmElectric: data.zip_screen_price_per_sqm_electric as number,
      runningMeters: data.zip_screen_running_meters as number,
    },
    lighting: {
      enabled: data.lighting_enabled as boolean,
      pricePerMeter: data.lighting_price_per_meter as number,
      runningMeters: data.lighting_running_meters as number,
    },
    drainage: {
      enabled: data.drainage_enabled as boolean,
      pricePerMeter: data.drainage_price_per_meter as number,
      runningMeters: data.drainage_running_meters as number,
    },
    winterClosure: {
      enabled: data.winter_closure_enabled as boolean,
      items: (data.winter_closure_items as unknown[]) || [],
      glassType: data.winter_closure_glass_type as string | undefined,
    },
    options: {
      notes: data.options_notes as string | undefined,
    },
    discountPercent: (data.discount_percent as number) || 0,

    area: data.area as number,
    pergolaTotal: data.pergola_total as number | undefined,
    santafTotal: data.santaf_total as number,
    zipScreenTotal: data.zip_screen_total as number,
    lightingTotal: data.lighting_total as number,
    drainageTotal: data.drainage_total as number,
    winterClosureTotal: (data.winter_closure_total as number) || 0,
    totalBeforeVat: data.total_before_vat as number,
    vatPercent: (data.vat_percent as number) || 18,
    vatAmount: data.vat_amount as number,
    priceWithVat: data.price_with_vat as number,
    discountAmount: data.discount_amount as number,
    finalPrice: data.final_price as number,

    pricing: {
      pergolaTotal: data.pergola_total as number,
      santafTotal: data.santaf_total as number,
      zipScreenTotal: data.zip_screen_total as number,
      lightingTotal: data.lighting_total as number,
      drainageTotal: data.drainage_total as number,
      winterClosureTotal: (data.winter_closure_total as number) || 0,
      totalBeforeVat: data.total_before_vat as number,
      vatPercent: (data.vat_percent as number) || 18,
      vatAmount: data.vat_amount as number,
      priceWithVat: data.price_with_vat as number,
      discountPercent: (data.discount_percent as number) || 0,
      discountAmount: data.discount_amount as number,
      finalPrice: data.final_price as number,
    },

    paymentTerms: data.payment_terms as Offer['paymentTerms'],
    warranty: data.warranty as Offer['warranty'],
    images: data.images as string[] | undefined,

    configuratorMeta: (data.configurator_meta as Offer['configuratorMeta']) ?? undefined,

    approval: {
      approved: data.approved as boolean,
      approvedAt: data.approved_at as string | undefined,
      signatureImage: data.signature_image as string | undefined,
      customerName: data.approval_customer_name as string | undefined,
      customerPhone: data.approval_customer_phone as string | undefined,
    },

    pdf: {
      url: data.pdf_url as string | undefined,
      createdAt: data.pdf_created_at as string | undefined,
    },

    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  } as Offer
}

export default async function OfferApprovePage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>
}) {
  const { id } = await params

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })

  const { data, error } = await supabase.from('offers').select('*').eq('id', id).single()

  if (error || !data) {
    notFound()
  }

  const offer = transformOfferFromDB(data as Record<string, unknown>)

  const companyId = data.company_id as string | undefined
  const pdfLocale = companyId ? await fetchCompanyPdfLocale(supabase, companyId) : 'he'

  // Render the PDF HTML server-side (needs filesystem access for fonts/logo)
  // Omit the static signature section — the client component renders an interactive pad instead.
  const offerHtml = renderOfferHtml(offer, null, true, pdfLocale)

  return (
    <ApproveClient
      offerId={id}
      offerHtml={offerHtml}
      alreadyApproved={offer.approval.approved === true}
      approvedAt={offer.approval.approvedAt ?? null}
      defaultName={offer.customerName ?? ''}
      defaultPhone={offer.customerPhone ?? ''}
    />
  )
}
