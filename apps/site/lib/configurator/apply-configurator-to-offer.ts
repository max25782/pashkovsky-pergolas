import type { SupabaseClient } from '@supabase/supabase-js'
import type { PergolaCalc, PergolaShape, OfferDraftCalc, RectangleShape } from './offer-calc-types'
import { calculateOffer } from './calculate-offer'

export interface PergolaParamsPayload {
  widthCm: number
  depthCm: number
  heightCm: number
  color: string
  lamellaAngleDeg: number
  attachedToWall: boolean
  lamellaGapCm: number
}

function rowToDraftCalc(data: Record<string, unknown>): OfferDraftCalc {
  const pergolasData = data.pergolas_data as PergolaCalc[] | null | undefined
  const pergolaShape = data.pergola_shape_data as PergolaShape | undefined
  const pergolas: PergolaCalc[] | undefined =
    pergolasData && Array.isArray(pergolasData) && pergolasData.length > 0
      ? pergolasData
      : pergolaShape
        ? [
            {
              shape: pergolaShape,
              height: data.pergola_height != null ? Number(data.pergola_height) : undefined,
              location: (data.pergola_location as string) || undefined,
              pricePerSqm: Number(data.pergola_price_per_sqm) || 750,
            },
          ]
        : data.pergola_width != null && data.pergola_length != null
          ? [
              {
                shape: {
                  type: 'rectangle',
                  width: Number(data.pergola_width),
                  length: Number(data.pergola_length),
                },
                height: data.pergola_height != null ? Number(data.pergola_height) : undefined,
                location: (data.pergola_location as string) || undefined,
                pricePerSqm: Number(data.pergola_price_per_sqm) || 750,
              },
            ]
          : undefined

  return {
    pergolas,
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
      type: (data.zip_screen_type as OfferDraftCalc['zipScreen']['type']) || undefined,
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
      items:
        (data.winter_closure_items as Array<{ area: number; pricePerSqm: number }>) || [],
    },
    discountPercent: Number(data.discount_percent) || 0,
  }
}

function mergeRectangle(
  draft: OfferDraftCalc,
  params: PergolaParamsPayload
): { draft: OfferDraftCalc; skippedNonRectangle: boolean; optionsNote?: string } {
  const w = Math.round((params.widthCm / 100) * 1000) / 1000
  const len = Math.round((params.depthCm / 100) * 1000) / 1000
  const h = Math.round((params.heightCm / 100) * 1000) / 1000

  const pergolas = draft.pergolas || []
  if (pergolas.length === 0) {
    return {
      draft: {
        ...draft,
        pergolas: [{ shape: { type: 'rectangle', width: w, length: len }, height: h, pricePerSqm: 750 }],
      },
      skippedNonRectangle: false,
    }
  }

  const first = pergolas[0]
  if (!first?.shape || first.shape.type !== 'rectangle') {
    const note = `[3D configurator] ${w}×${len}m, H ${h}m, color ${params.color}`
    return { draft, skippedNonRectangle: true, optionsNote: note }
  }

  const next = [...pergolas]
  next[0] = {
    ...first,
    shape: { type: 'rectangle', width: w, length: len },
    height: h,
    pricePerSqm: first.pricePerSqm ?? 750,
  }
  return { draft: { ...draft, pergolas: next }, skippedNonRectangle: false }
}

export async function applyConfiguratorSubmissionToOffer(params: {
  supabase: SupabaseClient
  offerId: string
  pergolaParams: PergolaParamsPayload
  previewImageUrl: string | null
  /** Customer-facing read-only viewer URL (`view=1`). */
  viewUrl: string
  /** Staff editor URL (same token, no `view=1`). */
  editUrl: string
  submissionId: string
}): Promise<{ skippedNonRectangle: boolean }> {
  const { supabase, offerId, pergolaParams, previewImageUrl, viewUrl, editUrl, submissionId } = params

  const { data: row, error: fetchErr } = await supabase.from('offers').select('*').eq('id', offerId).single()
  if (fetchErr || !row) {
    throw new Error(fetchErr?.message || 'Offer not found')
  }

  const rowRec = row as Record<string, unknown>
  let draft = rowToDraftCalc(rowRec)
  const { draft: merged, skippedNonRectangle, optionsNote } = mergeRectangle(draft, pergolaParams)
  draft = merged

  const calc = calculateOffer(draft)
  const pergolas = draft.pergolas || []
  const first = pergolas[0]

  const existingImages: string[] = Array.isArray(row.images) ? [...row.images] : []
  const images = previewImageUrl
    ? [previewImageUrl, ...existingImages.filter((u) => u !== previewImageUrl)].slice(0, 20)
    : existingImages

  let optionsNotes = (row.options_notes as string) || ''
  if (optionsNote) {
    optionsNotes = optionsNotes ? `${optionsNotes}\n${optionsNote}` : optionsNote
  }

  const configurator_meta = {
    viewUrl,
    editUrl,
    previewImageUrl: previewImageUrl ?? null,
    lastSubmissionId: submissionId,
    updatedAt: new Date().toISOString(),
    skippedNonRectangle,
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
    options_notes: optionsNotes || null,
  }

  const { error: upErr } = await supabase.from('offers').update(updatePayload).eq('id', offerId)
  if (upErr) throw new Error(upErr.message)

  return { skippedNonRectangle }
}
