import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { PergolaShape } from '@/types/offer'
import { requireAuth, requireCompanyAccess } from '@/lib/auth'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

// GET - Get single offer by ID
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // 🔒 Security: Require authentication
  const auth = await requireAuth(req)
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
  } catch (error: any) {
    console.error('Error in GET /api/offers/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// DELETE - Remove single offer by ID
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // 🔒 Security: Require authentication
  const auth = await requireAuth(req)
  if (!auth.authorized) return auth.error

  if (!supabase) {
    return NextResponse.json(
      { error: 'Server not configured' },
      { status: 500 }
    )
  }

  try {
    // 🔒 Security: Fetch offer first to verify ownership
    const { data: offer, error: fetchError } = await supabase
      .from('offers')
      .select('company_id')
      .eq('id', params.id)
      .single()

    if (fetchError || !offer) {
      console.error('Error fetching offer for deletion:', fetchError)
      return NextResponse.json(
        { error: 'Offer not found' },
        { status: 404 }
      )
    }

    // 🔒 Security: Verify company access
    const access = await requireCompanyAccess(req, offer.company_id)
    if (!access.authorized) return access.error

    // Now safe to delete
    const { error } = await supabase
      .from('offers')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Error deleting offer:', error)
      return NextResponse.json(
        { error: 'Failed to delete offer' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE /api/offers/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// Helper function to transform DB row to Offer object
function transformOfferFromDB(data: any) {
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
      items: data.winter_closure_items || [],
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
