import type { SupabaseClient } from '@supabase/supabase-js'
import type { OfferDraft, PergolaShape, RectangleShape } from '@/types/offer'
import { calculateOffer } from '@/lib/offer-calculator'
import { legacyPergolaFromOfferColumns, normalizePergolas } from '@/lib/pergolas/normalize-pergola'

export interface PergolaParamsPayload {
  shapeType?: 'rectangle' | 'L' | 'U'
  widthCm: number
  depthCm: number
  heightCm: number
  arm1WidthCm?: number
  arm1DepthCm?: number
  color: string
  lamellaAngleDeg: number
  attachedToWall: boolean
  hangingPergola?: boolean
  hangerCount?: number
  lamellaGapCm: number
  beamLed?: boolean
  lamellaStanding?: boolean
  lamellaAlongWidth?: boolean
  postProfileId?: string | null
  beamProfileId?: string | null
  dividerProfileId?: string | null
  lamellaProfileId?: string | null
}

export function pairConfiguratorMetaUrls(
  editUrlIn: string | undefined,
  customerViewUrlIn: string | undefined,
  legacyViewUrl: string | undefined,
): { editUrl: string | null; customerViewUrl: string | null } {
  if (editUrlIn && customerViewUrlIn) {
    return { editUrl: editUrlIn, customerViewUrl: customerViewUrlIn }
  }
  if (!legacyViewUrl) return { editUrl: null, customerViewUrl: null }
  const v = legacyViewUrl.trim()
  const hasView1 = /(?:^|[?&])view=1(?:&|$)/.test(v)
  if (hasView1) {
    const edit = v
      .replace(/&view=1(?=&|$)/, '')
      .replace(/\?view=1&/, '?')
      .replace(/\?view=1$/, '')
      .replace(/\?$/, '')
    return { editUrl: edit, customerViewUrl: v }
  }
  const customer = v.includes('?') ? `${v}&view=1` : `${v}?view=1`
  return { editUrl: v, customerViewUrl: customer }
}

function rowToDraft(data: Record<string, unknown>): OfferDraft {
  function columnSlice(row: Record<string, unknown>) {
    return {
      pergola_shape_data: row.pergola_shape_data,
      pergola_width: row.pergola_width as number | null,
      pergola_length: row.pergola_length as number | null,
      pergola_height: row.pergola_height as number | null,
      pergola_location: row.pergola_location as string | null,
      pergola_price_per_sqm: row.pergola_price_per_sqm as number | null,
    }
  }

  const pergolasFromDb = normalizePergolas(data.pergolas_data)
  const pergolaShape = data.pergola_shape_data as PergolaShape | undefined
  const pergolas =
    pergolasFromDb && pergolasFromDb.length > 0
      ? pergolasFromDb
      : pergolaShape
        ? [legacyPergolaFromOfferColumns({ ...columnSlice(data), pergola_shape_data: pergolaShape })]
        : data.pergola_width != null && data.pergola_length != null
          ? [legacyPergolaFromOfferColumns(columnSlice(data))]
          : undefined

  return {
    dealId: String(data.deal_id),
    customerName: String(data.customer_name),
    customerPhone: (data.customer_phone as string) || undefined,
    customerCity: (data.customer_city as string) || undefined,
    pergolas,
    color: {
      type: (data.color_type as OfferDraft['color']['type']) || 'white',
      ralCode: (data.color_ral_code as string) || undefined,
      woodName: (data.color_wood_name as string) || undefined,
    },
    roof: {
      type: (data.roof_type as OfferDraft['roof']['type']) || null,
      santafColor: (data.roof_santaf_color as OfferDraft['roof']['santafColor']) || undefined,
    },
    shadingRatio: (data.shading_ratio as OfferDraft['shadingRatio']) ?? null,
    finishType: (data.finish_type as OfferDraft['finishType']) ?? null,
    finishValue: (data.finish_value as string) ?? null,
    santaf: {
      enabled: Boolean(data.santaf_enabled),
      withStructure: Boolean(data.santaf_with_structure),
      pricePerSqmBasic: Number(data.santaf_price_per_sqm_basic) || 0,
      pricePerSqmWithStructure: Number(data.santaf_price_per_sqm_with_structure) || 0,
      width: data.santaf_width != null ? Number(data.santaf_width) : undefined,
      length: data.santaf_length != null ? Number(data.santaf_length) : undefined,
      overlapType: 'double',
    },
    zipScreen: {
      enabled: Boolean(data.zip_screen_enabled),
      type: (data.zip_screen_type as OfferDraft['zipScreen']['type']) || undefined,
      pricePerSqmManual: Number(data.zip_screen_price_per_sqm_manual) || 0,
      pricePerSqmElectric: Number(data.zip_screen_price_per_sqm_electric) || 0,
      runningMeters:
        data.zip_screen_running_meters != null ? Number(data.zip_screen_running_meters) : undefined,
    },
    lighting: {
      enabled: Boolean(data.lighting_enabled),
      pricePerMeter: Number(data.lighting_price_per_meter) || 0,
      runningMeters:
        data.lighting_running_meters != null ? Number(data.lighting_running_meters) : undefined,
    },
    drainage: {
      enabled: Boolean(data.drainage_enabled),
      pricePerMeter: Number(data.drainage_price_per_meter) || 0,
      runningMeters:
        data.drainage_running_meters != null ? Number(data.drainage_running_meters) : undefined,
    },
    winterClosure: {
      enabled: Boolean(data.winter_closure_enabled),
      items: (data.winter_closure_items as OfferDraft['winterClosure']['items']) || [],
      glassType: (data.winter_closure_glass_type as OfferDraft['winterClosure']['glassType']) || undefined,
    },
    options: {
      notes: (data.options_notes as string) || undefined,
    },
    vatPercent: (() => {
      const vp = Number(data.vat_percent)
      return Number.isFinite(vp) ? Math.min(100, Math.max(0, vp)) : 18
    })(),
    discountPercent: Number(data.discount_percent) || 0,
    images: (data.images as string[]) || undefined,
  }
}

function mergeRectangleFromConfigurator(
  draft: OfferDraft,
  params: PergolaParamsPayload,
): { draft: OfferDraft; skippedNonRectangle: boolean } {
  const w = Math.round((params.widthCm / 100) * 1000) / 1000
  const len = Math.round((params.depthCm / 100) * 1000) / 1000
  const h = Math.round((params.heightCm / 100) * 1000) / 1000

  const pergolas = draft.pergolas || (draft.pergola ? [draft.pergola] : [])
  if (pergolas.length === 0) {
    return {
      draft: {
        ...draft,
        pergolas: [
          {
            plan: null,
            shape: { type: 'rectangle', width: w, length: len },
            height: h,
            pricePerSqm: 750,
          },
        ],
      },
      skippedNonRectangle: false,
    }
  }

  const first = pergolas[0]
  if (!first?.shape || first.shape.type !== 'rectangle') {
    const note = `[3D configurator] Submission: ${w}×${len}m, H ${h}m, color ${params.color}`
    const prev = draft.options?.notes || ''
    return {
      draft: {
        ...draft,
        options: {
          ...draft.options,
          notes: prev ? `${prev}\n${note}` : note,
        },
      },
      skippedNonRectangle: true,
    }
  }

  const nextPergolas = [...pergolas]
  nextPergolas[0] = {
    ...first,
    shape: { type: 'rectangle', width: w, length: len },
    height: h,
    pricePerSqm: first.pricePerSqm ?? 750,
  }
  return { draft: { ...draft, pergolas: nextPergolas }, skippedNonRectangle: false }
}

export async function applyConfiguratorSyncToOffer(
  supabase: SupabaseClient,
  offerId: string,
  input: {
    params: PergolaParamsPayload
    previewImageUrl?: string | null
    editUrl?: string | null
    customerViewUrl?: string | null
    legacyViewUrl?: string | null
    submissionId?: string | null
  },
): Promise<{ skippedNonRectangle: boolean }> {
  const { params, previewImageUrl, submissionId } = input
  const { editUrl, customerViewUrl } = pairConfiguratorMetaUrls(
    input.editUrl ?? undefined,
    input.customerViewUrl ?? undefined,
    input.legacyViewUrl ?? undefined,
  )

  const { data: row, error: fetchErr } = await supabase.from('offers').select('*').eq('id', offerId).single()
  if (fetchErr || !row) {
    throw new Error('Offer not found')
  }

  let draft = rowToDraft(row as Record<string, unknown>)
  const { draft: merged, skippedNonRectangle } = mergeRectangleFromConfigurator(draft, params)
  draft = merged

  const calc = calculateOffer(draft)
  const pergolas = draft.pergolas || (draft.pergola ? [draft.pergola] : [])
  const first = pergolas[0]

  const existingImages: string[] = Array.isArray(row.images) ? [...row.images] : []
  const images =
    previewImageUrl && !skippedNonRectangle
      ? [previewImageUrl, ...existingImages.filter((u) => u !== previewImageUrl)].slice(0, 20)
      : previewImageUrl
        ? [previewImageUrl, ...existingImages.filter((u) => u !== previewImageUrl)].slice(0, 20)
        : existingImages

  const configurator_meta = {
    viewUrl: customerViewUrl ?? null,
    editUrl: editUrl ?? null,
    previewImageUrl: previewImageUrl ?? null,
    lastSubmissionId: submissionId ?? null,
    updatedAt: new Date().toISOString(),
    skippedNonRectangle,
    params: {
      shapeType: params.shapeType ?? 'rectangle',
      widthCm: params.widthCm,
      depthCm: params.depthCm,
      heightCm: params.heightCm,
      arm1WidthCm: params.arm1WidthCm ?? 200,
      arm1DepthCm: params.arm1DepthCm ?? 200,
      color: params.color,
      lamellaAngleDeg: params.lamellaAngleDeg,
      attachedToWall: params.attachedToWall,
      hangingPergola: params.hangingPergola ?? false,
      hangerCount: params.hangerCount ?? 2,
      lamellaGapCm: params.lamellaGapCm,
      beamLed: params.beamLed ?? false,
      lamellaStanding: params.lamellaStanding ?? false,
      lamellaAlongWidth: params.lamellaAlongWidth ?? false,
      postProfileId: params.postProfileId ?? null,
      beamProfileId: params.beamProfileId ?? null,
      dividerProfileId: params.dividerProfileId ?? null,
      lamellaProfileId: params.lamellaProfileId ?? null,
    },
  }

  const updatePayload: Record<string, unknown> = {
    pergolas_data: pergolas.length > 0 ? pergolas : null,
    pergola_shape_type: first?.shape?.type ?? null,
    pergola_shape_data: first?.shape ?? null,
    pergola_height: first?.height ?? null,
    pergola_location: first?.location ?? null,
    pergola_price_per_sqm: first ? Number(first.pricePerSqm) || 750 : null,
    pergola_width:
      first?.shape?.type === 'rectangle' ? (first.shape as RectangleShape).width : row.pergola_width,
    pergola_length:
      first?.shape?.type === 'rectangle' ? (first.shape as RectangleShape).length : row.pergola_length,
    area: calc.area,
    pergola_total: calc.pergolaTotal ?? 0,
    santaf_total: calc.santafTotal,
    zip_screen_total: calc.zipScreenTotal,
    lighting_total: calc.lightingTotal,
    drainage_total: calc.drainageTotal,
    winter_closure_total: calc.winterClosureTotal,
    total_before_vat: calc.totalBeforeVat,
    vat_percent: calc.vatPercent,
    vat_amount: calc.vatAmount,
    price_with_vat: calc.priceWithVat,
    discount_percent: calc.discountPercent,
    discount_amount: calc.discountAmount,
    final_price: calc.finalPrice,
    images,
    configurator_meta,
    options_notes: draft.options?.notes ?? row.options_notes,
  }

  const { error: upErr } = await supabase.from('offers').update(updatePayload).eq('id', offerId)
  if (upErr) {
    throw new Error(upErr.message)
  }

  return { skippedNonRectangle }
}
