import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { DEFAULT_OFFER_VALUES, PergolaShape } from '@/types/offer'
import { calculatePergolaArea, validatePergolaShape } from '@/lib/calculations/pergola-area'
import { getCompanyId } from '@/lib/middleware/company-context'

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

  // Get company_id from authentication context
  const companyId = getCompanyId(req)
  if (!companyId) {
    return NextResponse.json(
      { error: 'Unauthorized: No company context' },
      { status: 401 }
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

    // Validate required fields
    if (!dealId || !customerName) {
      return NextResponse.json(
        { error: 'Invalid offer data: dealId and customerName are required' },
        { status: 400 }
      )
    }

    if (!pergola || !pergola.shape) {
      return NextResponse.json(
        { error: 'Invalid offer data: pergola shape is required' },
        { status: 400 }
      )
    }

    // Validate pergola shape
    const shapeValidation = validatePergolaShape(pergola.shape)
    if (!shapeValidation.valid) {
      return NextResponse.json(
        { error: `Invalid pergola shape: ${shapeValidation.error}` },
        { status: 400 }
      )
    }

    // Ensure required objects exist with defaults
    const finalColor = color || { type: 'white' }
    const finalRoof = roof || { type: 'open' }
    const finalSantaf = santaf || { enabled: false, withStructure: false, pricePerSqmBasic: 0, pricePerSqmWithStructure: 0 }
    const finalZipScreen = zipScreen || { enabled: false, pricePerSqmManual: 0, pricePerSqmElectric: 0 }
    const finalLighting = lighting || { enabled: false, pricePerMeter: 0 }
    const finalDrainage = drainage || { enabled: false, pricePerMeter: 0 }
    const finalWinterClosure = winterClosure || { enabled: false }
    const finalOptions = options || { notes: null }

    // Calculate area from shape
    const calculatedArea = calculatePergolaArea(pergola.shape)
    
    // Use provided area or calculated area
    const finalArea = area || calculatedArea

    // Prepare insert data with proper defaults
    const insertData: any = {
      deal_id: dealId,
      customer_name: customerName,
      customer_phone: body.customerPhone || null,
      customer_city: body.customerCity || null,
      
      // Multi-tenant: Add company_id
      company_id: companyId,
      
      // Pergola - new shape-based structure
      pergola_shape_type: pergola.shape.type,
      pergola_shape_data: pergola.shape as any, // JSONB will store the shape object
      pergola_height: pergola.height ? Number(pergola.height) : null,
      pergola_location: pergola.location || null,
      pergola_price_per_sqm: Number(pergola.pricePerSqm) || 750,
      
      // Legacy fields for backward compatibility (extract from shape if rectangle)
      pergola_width: pergola.shape.type === 'rectangle' ? pergola.shape.width : null,
      pergola_length: pergola.shape.type === 'rectangle' ? pergola.shape.length : null,
      
      // Color
      color_type: finalColor.type,
      color_ral_code: finalColor.ralCode || null,
      color_wood_name: finalColor.woodName || null,
      
      // Roof
      roof_type: finalRoof.type,
      roof_santaf_color: finalRoof.santafColor || null,
      shading_ratio: shadingRatio || null,
      finish_type: finishType || null,
      finish_value: finishValue || null,
      
      // Santaf
      santaf_enabled: finalSantaf.enabled,
      santaf_with_structure: finalSantaf.withStructure,
      santaf_price_per_sqm_basic: Number(finalSantaf.pricePerSqmBasic) || 0,
      santaf_price_per_sqm_with_structure: Number(finalSantaf.pricePerSqmWithStructure) || 0,
      
      // ZIP Screen
      zip_screen_enabled: finalZipScreen.enabled,
      zip_screen_type: finalZipScreen.type || null,
      zip_screen_price_per_sqm_manual: Number(finalZipScreen.pricePerSqmManual) || 0,
      zip_screen_price_per_sqm_electric: Number(finalZipScreen.pricePerSqmElectric) || 0,
      zip_screen_running_meters: finalZipScreen.runningMeters ? Number(finalZipScreen.runningMeters) : null,
      
      // Lighting
      lighting_enabled: finalLighting.enabled,
      lighting_price_per_meter: Number(finalLighting.pricePerMeter) || 0,
      lighting_running_meters: finalLighting.runningMeters ? Number(finalLighting.runningMeters) : null,
      
      // Drainage
      drainage_enabled: finalDrainage.enabled,
      drainage_price_per_meter: Number(finalDrainage.pricePerMeter) || 0,
      drainage_running_meters: finalDrainage.runningMeters ? Number(finalDrainage.runningMeters) : null,
      
      // Winter Closure
      winter_closure_enabled: finalWinterClosure.enabled,
      winter_closure_glass_type: finalWinterClosure.glassType || null,
      winter_closure_items: finalWinterClosure.items || [],
      winter_closure_total: finalWinterClosure.items.reduce((sum: number, item: any) => sum + (item.area * item.pricePerSqm), 0),
      
      // Options (notes only now)
      options_notes: finalOptions.notes || null,
      
      // Calculated values (ensure they are numbers, not undefined or NaN)
      area: Number(finalArea) || 0,
      pergola_total: Number(pergolaTotal) || 0,
      santaf_total: Number(santafTotal) || 0,
      zip_screen_total: Number(zipScreenTotal) || 0,
      lighting_total: Number(lightingTotal) || 0,
      drainage_total: Number(drainageTotal) || 0,
      total_before_vat: Number(totalBeforeVat) || 0,
      vat_percent: 18,
      vat_amount: Number(vatAmount) || 0,
      price_with_vat: Number(priceWithVat) || 0,
      discount_percent: Number(discountPercent) || 0,
      discount_amount: Number(discountAmount) || 0,
      final_price: Number(finalPrice) || 0,
      
      // Payment terms (use defaults)
      payment_terms: DEFAULT_OFFER_VALUES.paymentTerms,
      
      // Warranty (use defaults)
      warranty: DEFAULT_OFFER_VALUES.warranty,
      
      // Images
      images: body.images || null,
      
      // Approval (initially false)
      approved: false,
    }

    // Insert offer into database
    const { data, error } = await supabase
      .from('offers')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('Error creating offer:', error)
      console.error('Insert data:', JSON.stringify(insertData, null, 2))
      return NextResponse.json(
        { error: 'Failed to create offer', details: error.message, code: error.code },
        { status: 500 }
      )
    }

    // Transform to camelCase for response
    const offer = transformOfferFromDB(data)

    return NextResponse.json(offer, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/offers:', error)
    console.error('Error stack:', error.stack)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
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
    },
    
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}
