/**
 * Public API endpoint for viewing offers
 * Does NOT require authentication - for customer approval pages
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Pergola, PergolaShape } from '@/types/offer'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

// GET - Get single offer by ID (public, no auth required)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!supabase) {
    return NextResponse.json(
      { error: 'Server not configured' },
      { status: 500 }
    )
  }

  try {
    // Fetch offer (public access - no company_id check)
    const { data, error } = await supabase
      .from('offers')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      console.error('Error fetching offer:', error)
      return NextResponse.json(
        { error: 'Offer not found' },
        { status: 404 }
      )
    }

    // Transform to camelCase
    const offer = transformOfferFromDB(data)

    return NextResponse.json(offer)
  } catch (error: unknown) {
    console.error('Error in GET /api/public/offers/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function transformOfferFromDB(data: any) {
  const pergolasData = data.pergolas_data as Pergola[] | null | undefined
  const hasPergolasArray = pergolasData && Array.isArray(pergolasData) && pergolasData.length > 0

  let pergolaShape: PergolaShape
  if (data.pergola_shape_data) {
    pergolaShape = data.pergola_shape_data as PergolaShape
  } else {
    pergolaShape = {
      type: 'rectangle',
      width: data.pergola_width || 0,
      length: data.pergola_length || 0,
    }
  }

  const pergolaSingle = hasPergolasArray
    ? pergolasData![0]
    : {
        shape: pergolaShape,
        height: data.pergola_height,
        location: data.pergola_location,
        pricePerSqm: data.pergola_price_per_sqm,
        width: data.pergola_width,
        length: data.pergola_length,
      }

  return {
    id: data.id,
    dealId: data.deal_id,
    customerName: data.customer_name,
    customerPhone: data.customer_phone,
    customerCity: data.customer_city,

    pergolas: hasPergolasArray ? pergolasData : undefined,
    pergola: pergolaSingle,
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
    discountPercent: data.discount_percent || 0,

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

    configuratorMeta: data.configurator_meta ?? undefined,

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

