import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { DEFAULT_OFFER_VALUES, PergolaShape, type OfferDraft } from '@/types/offer'
import { calculatePergolaArea, validatePergolaShape } from '@/lib/calculations/pergola-area'
import { getCompanyIdAsync } from '@/lib/middleware/company-context'
import {
  buildQuickOfferExtra,
  hasAnyQuickOfferProduct,
  resolveQuickOfferIncludes,
} from '@/lib/quick-offer-includes'
import { validateQuickFence, validateQuickRailings } from '@/lib/quick-offer-product-validation'
import { pergolaFieldsFromOfferRow } from '@/lib/pdf/map-offer-db-row-for-pdf'

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

  // Get company_id from authentication context (async for Supabase Auth)
  const companyId = await getCompanyIdAsync(req)
  if (!companyId) {
    console.error('[POST /api/offers] No company context found')
    return NextResponse.json(
      { error: 'Unauthorized: No company context' },
      { status: 401 }
    )
  }
  

  try {
    const body = await req.json()
    const draftBody = body as Partial<OfferDraft> & Record<string, unknown>
    const includes = resolveQuickOfferIncludes(draftBody)

    if (!hasAnyQuickOfferProduct(includes)) {
      return NextResponse.json({ error: 'Select at least one product line' }, { status: 400 })
    }

    if (includes.railings) {
      const err = validateQuickRailings(draftBody)
      if (err) return NextResponse.json({ error: err }, { status: 400 })
    }
    if (includes.fence) {
      const err = validateQuickFence(draftBody)
      if (err) return NextResponse.json({ error: err }, { status: 400 })
    }

    // Validate required fields
    const {
      dealId,
      customerName,
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
      vatPercent: bodyVatPercent,
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

    // Support multiple pergolas when pergola line is included
    const pergolasRaw = body.pergolas || (body.pergola ? [body.pergola] : [])
    const pergolas = includes.pergola ? pergolasRaw : []

    if (includes.pergola) {
      for (const perg of pergolas) {
        if (perg?.shape) {
          const shapeValidation = validatePergolaShape(perg.shape)
          if (!shapeValidation.valid) {
            return NextResponse.json(
              { error: `Invalid pergola shape: ${shapeValidation.errors.join(', ')}` },
              { status: 400 },
            )
          }
        }
      }
    }

    const pergola = pergolas.length > 0 ? pergolas[0] : undefined

    // Ensure required objects exist with defaults
    const finalColor = color || { type: 'white' }
    const finalRoof = roof || { type: 'open' }
    const finalSantaf = santaf || { enabled: false, withStructure: false, pricePerSqmBasic: 0, pricePerSqmWithStructure: 0, width: undefined, length: undefined }
    const finalZipScreen = zipScreen || { enabled: false, pricePerSqmManual: 0, pricePerSqmElectric: 0 }
    const finalLighting = lighting || { enabled: false, pricePerMeter: 0 }
    const finalDrainage = drainage || { enabled: false, pricePerMeter: 0 }
    const finalWinterClosure = winterClosure || { enabled: false }
    const finalOptions = options || { notes: null }

    if (!includes.pergola && finalSantaf.enabled) {
      if (!finalSantaf.width || !finalSantaf.length) {
        return NextResponse.json(
          { error: 'Santaf dimensions (width and length) are required when pergola is not included' },
          { status: 400 }
        )
      }
    }

    // Calculate total area from all pergolas
    let calculatedArea = 0
    for (const perg of pergolas) {
      if (perg?.shape) {
        calculatedArea += calculatePergolaArea(perg.shape)
      }
    }

    // Calculate Santaf area if pergola is not included
    const santafArea = (!pergola && finalSantaf.enabled && finalSantaf.width && finalSantaf.length) 
      ? finalSantaf.width * finalSantaf.length 
      : 0

    // Use provided area, calculated pergola area, or Santaf area
    const finalArea = area || calculatedArea || santafArea

    const rawVatPct = Number(bodyVatPercent)
    const storedVatPercent =
      Number.isFinite(rawVatPct) ? Math.min(100, Math.max(0, rawVatPct)) : 18

    const quickOfferExtra = buildQuickOfferExtra(draftBody, {
      railingsLineTotal:
        body.railingsLineTotal != null ? Number(body.railingsLineTotal) : undefined,
      fenceLineTotal: body.fenceLineTotal != null ? Number(body.fenceLineTotal) : undefined,
    })

    const pergolaTotalStored =
      body.pergolaTotal != null
        ? Number(body.pergolaTotal)
        : !includes.pergola && body.railingsLineTotal != null
          ? Number(body.railingsLineTotal)
          : !includes.pergola && body.fenceLineTotal != null
            ? Number(body.fenceLineTotal)
            : 0

    // Prepare insert data with proper defaults
    const insertData: Record<string, unknown> = {
      deal_id: dealId,
      customer_name: customerName,
      customer_phone: body.customerPhone || null,
      customer_city: body.customerCity || null,
      
      // Multi-tenant: Add company_id
      company_id: companyId,
      
      // Pergolas - support multiple pergolas (new)
      pergolas_data: includes.pergola && pergolas.length > 0 ? pergolas : null,
      quick_offer_extra: quickOfferExtra,
      
      // Pergola - single pergola for backward compatibility (use first pergola if array exists)
      pergola_shape_type: pergola?.shape?.type || null,
      pergola_shape_data: pergola?.shape as any, // JSONB will store the shape object
      pergola_height: pergola?.height ? Number(pergola.height) : null,
      pergola_location: pergola?.location || null,
      pergola_price_per_sqm: pergola ? Number(pergola.pricePerSqm) || 750 : null,

      // Legacy fields for backward compatibility (extract from shape if rectangle)
      // Also use for Santaf dimensions when pergola is not included
      pergola_width: pergola?.shape?.type === 'rectangle' 
        ? pergola.shape.width 
        : (!pergola && finalSantaf.enabled && finalSantaf.width) 
          ? Number(finalSantaf.width) 
          : 0, // Default to 0 if neither pergola nor santaf dimensions provided
      pergola_length: pergola?.shape?.type === 'rectangle' 
        ? pergola.shape.length 
        : (!pergola && finalSantaf.enabled && finalSantaf.length) 
          ? Number(finalSantaf.length) 
          : 0, // Default to 0 if neither pergola nor santaf dimensions provided
      
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
      pergola_total: pergolaTotalStored,
      santaf_total: Number(santafTotal) || 0,
      zip_screen_total: Number(zipScreenTotal) || 0,
      lighting_total: Number(lightingTotal) || 0,
      drainage_total: Number(drainageTotal) || 0,
      total_before_vat: Number(totalBeforeVat) || 0,
      vat_percent: storedVatPercent,
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

    if (includes.railings && draftBody.quickRailings) {
      const qr = draftBody.quickRailings
      const gsInsert = String(qr.glazingSystem).trim() as 'aluminum_glass' | 'wet_glazing' | 'dry_glazing'
      const railPayload = {
        deal_id: dealId,
        company_id: companyId,
        meters_total: Number(qr.metersTotal),
        height_cm: qr.heightCm != null ? Number(qr.heightCm) : null,
        profile_type: String(qr.profileType).trim(),
        color: String(qr.color).trim(),
        location_type: String(qr.locationType).trim() as 'balcony' | 'stairs' | 'roof' | 'yard' | 'other',
        glass_type: qr.glassType != null && String(qr.glassType).trim() !== '' ? String(qr.glassType).trim() : null,
        glazing_system: gsInsert,
        notes: qr.notes != null && String(qr.notes).trim() !== '' ? String(qr.notes).trim() : null,
      }
      const { data: existingRail } = await supabase
        .from('deal_railings_details')
        .select('deal_id')
        .eq('deal_id', dealId)
        .maybeSingle()
      if (existingRail) {
        await supabase.from('deal_railings_details').update(railPayload).eq('deal_id', dealId)
      } else {
        await supabase.from('deal_railings_details').insert(railPayload)
      }
    }

    if (includes.fence && draftBody.quickFence) {
      const qf = draftBody.quickFence
      const fencePayload = {
        deal_id: dealId,
        company_id: companyId,
        meters_total: Number(qf.metersTotal),
        height_cm: qf.heightCm != null ? Number(qf.heightCm) : null,
        fence_variant: String(qf.fenceVariant).trim() as 'classic' | 'hitech' | 'hitech_angular',
        color: String(qf.color).trim(),
        notes: qf.notes != null && String(qf.notes).trim() !== '' ? String(qf.notes).trim() : null,
      }
      const { data: existingFence } = await supabase
        .from('deal_fence_details')
        .select('deal_id')
        .eq('deal_id', dealId)
        .maybeSingle()
      if (existingFence) {
        await supabase.from('deal_fence_details').update(fencePayload).eq('deal_id', dealId)
      } else {
        await supabase.from('deal_fence_details').insert(fencePayload)
      }
    }

    // Transform to camelCase for response
    const offer = transformOfferFromDB(data)

    return NextResponse.json(offer, { status: 201 })
  } catch (error: unknown) {
    const e = error instanceof Error ? error : null
    console.error('Error in POST /api/offers:', error)
    console.error('Error stack:', e?.stack)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: e?.message ?? String(error),
        stack: process.env.NODE_ENV === 'development' ? e?.stack : undefined
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
  } catch (error: unknown) {
    console.error('Error in GET /api/offers:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// Helper function to transform DB row to Offer object
function transformOfferFromDB(data: Record<string, unknown>) {
  const pf = pergolaFieldsFromOfferRow({
    pergolas_data: data.pergolas_data,
    pergola_shape_data: data.pergola_shape_data,
    pergola_width: data.pergola_width as number | null,
    pergola_length: data.pergola_length as number | null,
    pergola_height: data.pergola_height as number | null,
    pergola_location: data.pergola_location as string | null,
    pergola_price_per_sqm: data.pergola_price_per_sqm as number | null,
    quick_offer_extra: data.quick_offer_extra,
  })
  const quickExtra = pf.quickOfferExtra

  return {
    id: data.id,
    dealId: data.deal_id,
    customerName: data.customer_name,
    customerPhone: data.customer_phone,
    customerCity: data.customer_city,
    quickProduct: pf.quickProduct,
    quickRailings: pf.quickRailings,
    quickFence: pf.quickFence,
    quickOfferExtra: quickExtra,
    includePergola: quickExtra?.includePergola,
    includeRailings: quickExtra?.includeRailings,
    includeFence: quickExtra?.includeFence,

    ...(pf.pergolas || pf.pergola ? {
      pergolas: pf.pergolas,
      pergola: pf.pergola,
    } : {}),
    
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
    railingsLineTotal: quickExtra?.railingsLineTotal,
    fenceLineTotal: quickExtra?.fenceLineTotal,
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
