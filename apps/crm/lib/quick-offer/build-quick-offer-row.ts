import { STANDARD_INSTALLATION_PAYMENT_TERMS } from '@/lib/commercial/standard-installation-terms'
import type { OfferDraft, Pergola, PergolaShape } from '@/types/offer'
import type { OfferCalculation } from '@/types/offer'
import type { QuickOfferExtraPersisted } from '@/types/offer'
import { pergolaPlanBboxMeters } from '@/lib/pergolas/pergola-plan-bbox'

export function pergolaLegacyDbColumns(firstPergola: Pergola | undefined) {
  if (!firstPergola) {
    return {
      pergola_shape_data: null as PergolaShape | null,
      pergola_width: null as number | null,
      pergola_length: null as number | null,
    }
  }
  const bbox = pergolaPlanBboxMeters(firstPergola)
  const pergola_shape_data =
    firstPergola.plan == null && firstPergola.shape ? firstPergola.shape : null
  return {
    pergola_shape_data,
    pergola_width: bbox?.width ?? null,
    pergola_length: bbox?.length ?? null,
  }
}

export function buildQuickOfferInsertRow(params: {
  dealId: string
  companyId: string
  draft: Partial<OfferDraft>
  includes: { pergola: boolean; railings: boolean; fence: boolean }
  normalizedPergolas: Pergola[]
  serverCalc: OfferCalculation
  quickOfferExtra: QuickOfferExtraPersisted | null
  customerName: string
}): Record<string, unknown> {
  const {
    dealId,
    companyId,
    draft,
    includes,
    normalizedPergolas,
    serverCalc,
    quickOfferExtra,
    customerName,
  } = params

  const firstPergola = normalizedPergolas[0]
  const pergolasData = includes.pergola && normalizedPergolas.length > 0 ? normalizedPergolas : null
  const legacyCols = includes.pergola ? pergolaLegacyDbColumns(firstPergola) : pergolaLegacyDbColumns(undefined)

  const color = draft.color as { type?: string; ralCode?: string; woodName?: string } | undefined
  const roof = draft.roof as { type?: string; santafColor?: string } | undefined
  const santaf = draft.santaf as Record<string, unknown> | undefined
  const zipScreen = draft.zipScreen as Record<string, unknown> | undefined
  const lighting = draft.lighting as Record<string, unknown> | undefined
  const drainage = draft.drainage as Record<string, unknown> | undefined
  const winterClosure = draft.winterClosure as Record<string, unknown> | undefined
  const options = draft.options as { notes?: string } | undefined

  return {
    deal_id: dealId,
    company_id: companyId,
    customer_name: customerName,

    pergolas_data: pergolasData,
    pergola_shape_data: legacyCols.pergola_shape_data,
    pergola_width: legacyCols.pergola_width,
    pergola_length: legacyCols.pergola_length,
    pergola_height: includes.pergola ? firstPergola?.height ?? null : null,
    pergola_location: includes.pergola ? firstPergola?.location ?? null : null,
    pergola_price_per_sqm: firstPergola?.pricePerSqm ?? 750,

    color_type: color?.type ?? 'white',
    color_ral_code: color?.ralCode ?? null,
    color_wood_name: color?.woodName ?? null,
    roof_type: roof?.type ?? null,
    roof_santaf_color: roof?.santafColor ?? null,

    shading_ratio: draft.shadingRatio ?? null,
    finish_type: draft.finishType ?? null,
    finish_value: draft.finishValue ?? null,
    options_notes: options?.notes ?? null,
    discount_percent: Number(draft.discountPercent) || 0,

    santaf_enabled: Boolean(santaf?.enabled),
    santaf_with_structure: Boolean(santaf?.withStructure),
    santaf_price_per_sqm_basic: Number(santaf?.pricePerSqmBasic) || 220,
    santaf_price_per_sqm_with_structure: Number(santaf?.pricePerSqmWithStructure) || 450,

    zip_screen_enabled: Boolean(zipScreen?.enabled),
    zip_screen_type: zipScreen?.type ?? null,
    zip_screen_price_per_sqm_manual: Number(zipScreen?.pricePerSqmManual) || 650,
    zip_screen_price_per_sqm_electric: Number(zipScreen?.pricePerSqmElectric) || 800,
    zip_screen_running_meters: zipScreen?.runningMeters ?? null,

    lighting_enabled: Boolean(lighting?.enabled),
    lighting_price_per_meter: Number(lighting?.pricePerMeter) || 200,
    lighting_running_meters: lighting?.runningMeters ?? null,

    drainage_enabled: Boolean(drainage?.enabled),
    drainage_price_per_meter: Number(drainage?.pricePerMeter) || 500,
    drainage_running_meters: drainage?.runningMeters ?? null,

    winter_closure_enabled: Boolean(winterClosure?.enabled),
    winter_closure_items: (winterClosure?.items as unknown[]) ?? [],
    winter_closure_glass_type: winterClosure?.glassType ?? null,

    area: serverCalc.area,
    pergola_total:
      serverCalc.pergolaTotal != null
        ? serverCalc.pergolaTotal
        : !includes.pergola && serverCalc.railingsLineTotal != null
          ? serverCalc.railingsLineTotal
          : !includes.pergola && serverCalc.fenceLineTotal != null
            ? serverCalc.fenceLineTotal
            : 0,
    quick_offer_extra: quickOfferExtra,
    santaf_total: serverCalc.santafTotal,
    zip_screen_total: serverCalc.zipScreenTotal,
    lighting_total: serverCalc.lightingTotal,
    drainage_total: serverCalc.drainageTotal,
    winter_closure_total: serverCalc.winterClosureTotal,
    total_before_vat: serverCalc.totalBeforeVat,
    vat_percent: serverCalc.vatPercent,
    vat_amount: serverCalc.vatAmount,
    price_with_vat: serverCalc.priceWithVat,
    discount_amount: serverCalc.discountAmount,
    final_price: serverCalc.finalPrice,
    payment_terms: STANDARD_INSTALLATION_PAYMENT_TERMS,
  }
}
