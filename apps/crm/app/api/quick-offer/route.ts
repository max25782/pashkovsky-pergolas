/**
 * POST /api/quick-offer
 *
 * Creates a hidden deal (source='quick_offer') + offer.
 * The deal is excluded from the CRM board query until the user explicitly saves to CRM
 * via /api/quick-offer/[id]/save-to-crm (which sets source='quick_offer_saved').
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { getCompanyIdAsync } from '@/lib/middleware/company-context'
import type { OfferDraft, Pergola, PergolaShape } from '@/types/offer'

export const runtime = 'nodejs'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase =
  SUPABASE_URL && SERVICE_KEY
    ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
    : undefined

export async function POST(req: NextRequest) {
  const auth = await requireAuthAsync(req)
  if (!auth.authorized) return auth.error

  if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const companyId = await getCompanyIdAsync(req)
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // ── 1. Create a hidden deal (excluded from CRM board until saved) ──────────
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .insert({
      company_id: companyId,
      customer_name: 'הצעה מהירה',
      customer_phone: '',
      deal_status: 'in_progress',
      work_type: 'pergola',
      source: 'quick_offer',
      currency: 'ILS',
    })
    .select('id')
    .single()

  if (dealError || !deal) {
    console.error('[quick-offer] deal insert error:', dealError)
    return NextResponse.json({ error: 'Failed to create deal' }, { status: 500 })
  }

  const dealId = deal.id as string

  // ── 2. Build offer row from body ────────────────────────────────────────────
  const draft = body as Partial<OfferDraft> & Record<string, unknown>

  const pergolas = (draft.pergolas as Pergola[] | undefined) ?? []
  const firstPergola = pergolas[0]

  const pergolasData = pergolas.length > 0 ? pergolas : null
  const pergolaShapeData =
    firstPergola?.shape ?? (null as PergolaShape | null)
  const pergolaWidth =
    firstPergola?.shape?.type === 'rectangle' ? firstPergola.shape.width : null
  const pergolaLength =
    firstPergola?.shape?.type === 'rectangle' ? firstPergola.shape.length : null

  const color = draft.color as { type?: string; ralCode?: string; woodName?: string } | undefined
  const roof = draft.roof as { type?: string; santafColor?: string } | undefined
  const santaf = draft.santaf as Record<string, unknown> | undefined
  const zipScreen = draft.zipScreen as Record<string, unknown> | undefined
  const lighting = draft.lighting as Record<string, unknown> | undefined
  const drainage = draft.drainage as Record<string, unknown> | undefined
  const winterClosure = draft.winterClosure as Record<string, unknown> | undefined
  const options = draft.options as { notes?: string } | undefined

  const { data: offer, error: offerError } = await supabase
    .from('offers')
    .insert({
      deal_id: dealId,
      company_id: companyId,
      customer_name: 'הצעה מהירה',

      // Pergola data
      pergolas_data: pergolasData,
      pergola_shape_data: pergolaShapeData,
      pergola_width: pergolaWidth,
      pergola_length: pergolaLength,
      pergola_height: firstPergola?.height ?? null,
      pergola_location: firstPergola?.location ?? null,
      pergola_price_per_sqm: firstPergola?.pricePerSqm ?? 750,

      // Color & roof
      color_type: color?.type ?? 'white',
      color_ral_code: color?.ralCode ?? null,
      color_wood_name: color?.woodName ?? null,
      roof_type: roof?.type ?? null,
      roof_santaf_color: roof?.santafColor ?? null,

      // Options
      shading_ratio: draft.shadingRatio ?? null,
      finish_type: draft.finishType ?? null,
      finish_value: draft.finishValue ?? null,
      options_notes: options?.notes ?? null,
      discount_percent: Number(draft.discountPercent) || 0,

      // Santaf
      santaf_enabled: Boolean(santaf?.enabled),
      santaf_with_structure: Boolean(santaf?.withStructure),
      santaf_price_per_sqm_basic: Number(santaf?.pricePerSqmBasic) || 220,
      santaf_price_per_sqm_with_structure: Number(santaf?.pricePerSqmWithStructure) || 450,

      // ZIP screen
      zip_screen_enabled: Boolean(zipScreen?.enabled),
      zip_screen_type: zipScreen?.type ?? null,
      zip_screen_price_per_sqm_manual: Number(zipScreen?.pricePerSqmManual) || 650,
      zip_screen_price_per_sqm_electric: Number(zipScreen?.pricePerSqmElectric) || 800,
      zip_screen_running_meters: zipScreen?.runningMeters ?? null,

      // Lighting
      lighting_enabled: Boolean(lighting?.enabled),
      lighting_price_per_meter: Number(lighting?.pricePerMeter) || 200,
      lighting_running_meters: lighting?.runningMeters ?? null,

      // Drainage
      drainage_enabled: Boolean(drainage?.enabled),
      drainage_price_per_meter: Number(drainage?.pricePerMeter) || 500,
      drainage_running_meters: drainage?.runningMeters ?? null,

      // Winter closure
      winter_closure_enabled: Boolean(winterClosure?.enabled),
      winter_closure_items: (winterClosure?.items as unknown[]) ?? [],
      winter_closure_glass_type: winterClosure?.glassType ?? null,

      // Calculated totals (sent from client)
      area: Number(draft.area) || 0,
      pergola_total: draft.pergolaTotal != null ? Number(draft.pergolaTotal) : null,
      santaf_total: Number(draft.santafTotal) || 0,
      zip_screen_total: Number(draft.zipScreenTotal) || 0,
      lighting_total: Number(draft.lightingTotal) || 0,
      drainage_total: Number(draft.drainageTotal) || 0,
      winter_closure_total: Number(draft.winterClosureTotal) || 0,
      total_before_vat: Number(draft.totalBeforeVat) || 0,
      vat_percent: Number(draft.vatPercent) || 18,
      vat_amount: Number(draft.vatAmount) || 0,
      price_with_vat: Number(draft.priceWithVat) || 0,
      discount_amount: Number(draft.discountAmount) || 0,
      final_price: Number(draft.finalPrice) || 0,
    })
    .select('id')
    .single()

  if (offerError || !offer) {
    console.error('[quick-offer] offer insert error:', offerError)
    await supabase.from('deals').delete().eq('id', dealId)
    return NextResponse.json({ error: 'Failed to create offer' }, { status: 500 })
  }

  return NextResponse.json({ offerId: offer.id as string }, { status: 201 })
}
