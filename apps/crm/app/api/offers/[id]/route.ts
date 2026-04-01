import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Pergola, PergolaShape } from '@/types/offer'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { requireCompanyAccess } from '@/lib/auth'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

type OfferRouteParams = { id: string }

async function resolveOfferParams(
  params: OfferRouteParams | Promise<OfferRouteParams>,
): Promise<OfferRouteParams> {
  return await Promise.resolve(params)
}

/** True if table/column is missing in this database (old migrations). */
function isIgnorableSchemaError(err: { code?: string; message?: string } | null): boolean {
  if (err === null) return false
  const c = err.code ?? ''
  const m = err.message ?? ''
  return (
    c === '42P01' ||
    c === 'PGRST205' ||
    m.includes('does not exist') ||
    m.includes('schema cache')
  )
}

/**
 * Remove / detach rows that reference offers so DELETE is not blocked by FKs
 * (e.g. DBs where ON DELETE CASCADE / SET NULL was never applied).
 */
async function detachOfferRelations(offerId: string): Promise<{ errorMessage: string | null }> {
  if (!supabase) return { errorMessage: 'Server not configured' }

  let { error: subErr } = await supabase
    .from('pergola_config_submissions')
    .update({ offer_id: null })
    .eq('offer_id', offerId)
  if (subErr !== null && !isIgnorableSchemaError(subErr)) {
    const { error: delSubErr } = await supabase.from('pergola_config_submissions').delete().eq('offer_id', offerId)
    if (delSubErr !== null && !isIgnorableSchemaError(delSubErr)) {
      return { errorMessage: delSubErr.message }
    }
  }

  const { error: tokErr } = await supabase.from('configurator_link_tokens').delete().eq('offer_id', offerId)
  if (tokErr !== null && !isIgnorableSchemaError(tokErr)) {
    return { errorMessage: tokErr.message }
  }

  const { error: moErr } = await supabase.from('material_orders').update({ offer_id: null }).eq('offer_id', offerId)
  if (moErr !== null && !isIgnorableSchemaError(moErr)) {
    return { errorMessage: moErr.message }
  }

  return { errorMessage: null }
}

// GET - Get single offer by ID
export async function GET(
  req: NextRequest,
  context: { params: OfferRouteParams | Promise<OfferRouteParams> },
) {
  const params = await resolveOfferParams(context.params)
  // 🔒 Security: Require authentication
  const auth = await requireAuthAsync(req)
  if (!auth.authorized) return auth.error

  if (!supabase) {
    return NextResponse.json(
      { error: 'Server not configured' },
      { status: 500 }
    )
  }

  try {
    // Fetch offer
    const { data, error } = await supabase
      .from('offers')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      console.error('Error fetching offer:', error)
      return NextResponse.json(
        { error: 'Offer not found' },
        { status: 404 }
      )
    }

    // 🔒 Security: Verify company access
    const access = await requireCompanyAccess(req, data.company_id)
    if (!access.authorized) return access.error

    // Transform to camelCase
    const offer = transformOfferFromDB(data)

    return NextResponse.json(offer)
  } catch (error: unknown) {
    console.error('Error in GET /api/offers/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// DELETE - Remove single offer by ID
export async function DELETE(
  req: NextRequest,
  context: { params: OfferRouteParams | Promise<OfferRouteParams> },
) {
  // 🔒 Security: Require authentication
  const auth = await requireAuthAsync(req)
  if (!auth.authorized) return auth.error

  if (!supabase) {
    return NextResponse.json(
      { error: 'Server not configured' },
      { status: 500 }
    )
  }

  try {
    const params = await resolveOfferParams(context.params)
    const offerId = params.id
    if (offerId === undefined || offerId === '') {
      return NextResponse.json({ error: 'Missing offer id' }, { status: 400 })
    }

    // 🔒 Security: Fetch offer first to verify ownership
    const { data: offer, error: fetchError } = await supabase
      .from('offers')
      .select('company_id')
      .eq('id', offerId)
      .single()

    if (fetchError !== null || offer === null || offer === undefined) {
      console.error('Error fetching offer for deletion:', fetchError)
      return NextResponse.json(
        { error: 'Offer not found' },
        { status: 404 }
      )
    }

    // 🔒 Security: Verify company access
    const access = await requireCompanyAccess(req, offer.company_id)
    if (!access.authorized) return access.error

    const detach = await detachOfferRelations(offerId)
    if (detach.errorMessage !== null) {
      console.error('[DELETE offer] detach relations failed:', detach.errorMessage)
      return NextResponse.json(
        { error: 'Failed to detach related records', details: detach.errorMessage },
        { status: 500 },
      )
    }

    const { error: delErr } = await supabase.from('offers').delete().eq('id', offerId)

    if (delErr !== null) {
      console.error('Error deleting offer:', delErr)
      return NextResponse.json(
        { error: 'Failed to delete offer', details: delErr.message, code: delErr.code },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Error in DELETE /api/offers/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// Helper function to transform DB row to Offer object
function transformOfferFromDB(data: any) {
  const pergolasData = data.pergolas_data as Pergola[] | null | undefined
  const hasPergolasArray = pergolasData && Array.isArray(pergolasData) && pergolasData.length > 0

  const pergolaSingle = hasPergolasArray
    ? pergolasData![0]
    : {
        shape: data.pergola_shape_data
          ? (data.pergola_shape_data as PergolaShape)
          : {
              type: 'rectangle' as const,
              width: data.pergola_width || 0,
              length: data.pergola_length || 0,
            },
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
      // Restore Santaf dimensions from pergola_width/length if pergola is not included
      width: (!data.pergola_shape_data && data.santaf_enabled && data.pergola_width) ? Number(data.pergola_width) : undefined,
      length: (!data.pergola_shape_data && data.santaf_enabled && data.pergola_length) ? Number(data.pergola_length) : undefined,
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
