import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { DEFAULT_OFFER_VALUES } from '@/types/offer'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

// POST - Create new offer
export async function POST(req: NextRequest) {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Server not configured' },
      { status: 500 }
    )
  }

  try {
    const body = await req.json()

    // Validate required fields
    const {
      dealId,
      customerName,
      pergola,
      color,
      roof,
      shadingRatio,
      finishType,
      finishValue,
      santaf,
      zipScreen,
      lighting,
      drainage,
      winterClosure,
      options,
      discountPercent,
      area,
      pergolaTotal,
      santafTotal,
      zipScreenTotal,
      lightingTotal,
      drainageTotal,
      totalBeforeVat,
      vatAmount,
      priceWithVat,
      discountAmount,
      finalPrice,
    } = body

    if (!dealId || !customerName || !pergola || pergola.width <= 0 || pergola.length <= 0) {
      return NextResponse.json(
        { error: 'Invalid offer data' },
        { status: 400 }
      )
    }

    // Insert offer into database
    const { data, error } = await supabase
      .from('offers')
      .insert({
        deal_id: dealId,
        customer_name: customerName,
        customer_phone: body.customerPhone || null,
        customer_city: body.customerCity || null,
        
        // Pergola
        pergola_width: pergola.width,
        pergola_length: pergola.length,
        pergola_height: pergola.height || null,
        pergola_location: pergola.location || null,
        pergola_price_per_sqm: pergola.pricePerSqm,
        
        // Color
        color_type: color.type,
        color_ral_code: color.ralCode || null,
        color_wood_name: color.woodName || null,
        
        // Roof
        roof_type: roof.type,
        roof_santaf_color: roof.santafColor || null,
        shading_ratio: shadingRatio || null,
        finish_type: finishType || null,
        finish_value: finishValue || null,
        
        // Santaf
        santaf_enabled: santaf.enabled,
        santaf_with_structure: santaf.withStructure,
        santaf_price_per_sqm_basic: santaf.pricePerSqmBasic,
        santaf_price_per_sqm_with_structure: santaf.pricePerSqmWithStructure,
        
        // ZIP Screen
        zip_screen_enabled: zipScreen.enabled,
        zip_screen_type: zipScreen.type || null,
        zip_screen_price_per_sqm_manual: zipScreen.pricePerSqmManual,
        zip_screen_price_per_sqm_electric: zipScreen.pricePerSqmElectric,
        zip_screen_running_meters: zipScreen.runningMeters || null,
        
        // Lighting
        lighting_enabled: lighting.enabled,
        lighting_price_per_meter: lighting.pricePerMeter,
        lighting_running_meters: lighting.runningMeters || null,
        
        // Drainage
        drainage_enabled: drainage.enabled,
        drainage_price_per_meter: drainage.pricePerMeter,
        drainage_running_meters: drainage.runningMeters || null,
        
        // Winter Closure
        winter_closure_enabled: winterClosure.enabled,
        winter_closure_type: winterClosure.type || null,
        winter_closure_glass_type: winterClosure.glassType || null,
        
        // Options (notes only now)
        options_notes: options.notes || null,
        
        // Calculated values
        area,
        pergola_total: pergolaTotal,
        santaf_total: santafTotal,
        zip_screen_total: zipScreenTotal,
        lighting_total: lightingTotal,
        drainage_total: drainageTotal,
        total_before_vat: totalBeforeVat,
        vat_percent: 18,
        vat_amount: vatAmount,
        price_with_vat: priceWithVat,
        discount_percent: discountPercent,
        discount_amount: discountAmount,
        final_price: finalPrice,
        
        // Payment terms (use defaults)
        payment_terms: DEFAULT_OFFER_VALUES.paymentTerms,
        
        // Warranty (use defaults)
        warranty: DEFAULT_OFFER_VALUES.warranty,
        
        // Images
        images: body.images || null,
        
        // Approval (initially false)
        approved: false,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating offer:', error)
      return NextResponse.json(
        { error: 'Failed to create offer', details: error.message },
        { status: 500 }
      )
    }

    // Transform to camelCase for response
    const offer = transformOfferFromDB(data)

    return NextResponse.json(offer, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/offers:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// GET - Get offers for a deal
export async function GET(req: NextRequest) {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Server not configured' },
      { status: 500 }
    )
  }

  const { searchParams } = new URL(req.url)
  const dealId = searchParams.get('dealId')

  if (!dealId) {
    return NextResponse.json(
      { error: 'Deal ID is required' },
      { status: 400 }
    )
  }

  try {
    const { data, error } = await supabase
      .from('offers')
      .select('*')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching offers:', error)
      return NextResponse.json(
        { error: 'Failed to fetch offers', details: error.message },
        { status: 500 }
      )
    }

    // Transform to camelCase
    const offers = data.map(transformOfferFromDB)

    return NextResponse.json({ offers })
  } catch (error: any) {
    console.error('Error in GET /api/offers:', error)
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
      width: data.pergola_width,
      length: data.pergola_length,
      height: data.pergola_height,
      location: data.pergola_location,
      pricePerSqm: data.pergola_price_per_sqm,
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
