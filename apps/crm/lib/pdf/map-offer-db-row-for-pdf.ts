import type { Offer, Pergola, PergolaShape, QuickOfferExtraPersisted } from '@/types/offer'

/** Railings/fence-only quick offers must not reuse default pergola geometry for PDF / plans. */
export function isQuickOfferRailingsOrFenceRow(row: { quick_offer_extra?: unknown }): boolean {
  const ex = row.quick_offer_extra as QuickOfferExtraPersisted | null | undefined
  if (!ex) return false
  if (ex.includePergola === true) return false
  if (
    ex.includePergola === false &&
    (ex.includeRailings === true || ex.includeFence === true)
  ) {
    return true
  }
  const qp = ex.quickProduct
  return qp === 'railings' || qp === 'fence'
}

export function pergolaFieldsFromOfferRow(row: {
  pergolas_data?: unknown
  pergola_shape_data?: unknown
  pergola_width?: number | null
  pergola_length?: number | null
  pergola_height?: number | null
  pergola_location?: string | null
  pergola_price_per_sqm?: number | null
  quick_offer_extra?: unknown
}): Pick<Offer, 'pergolas' | 'pergola' | 'quickProduct' | 'quickRailings' | 'quickFence' | 'quickOfferExtra'> {
  const quickExtra = row.quick_offer_extra as QuickOfferExtraPersisted | null | undefined
  if (isQuickOfferRailingsOrFenceRow(row)) {
    return {
      pergolas: undefined,
      pergola: undefined,
      quickProduct: quickExtra?.quickProduct,
      quickRailings: quickExtra?.quickRailings,
      quickFence: quickExtra?.quickFence,
      quickOfferExtra: quickExtra ?? null,
    }
  }

  const pergolasFromDb = row.pergolas_data as Pergola[] | null | undefined
  const pergolaSingle: Offer['pergola'] =
    pergolasFromDb && pergolasFromDb.length > 0
      ? pergolasFromDb[0]
      : {
          shape: row.pergola_shape_data
            ? (row.pergola_shape_data as PergolaShape)
            : {
                type: 'rectangle' as const,
                width: row.pergola_width || 0,
                length: row.pergola_length || 0,
              },
          height: row.pergola_height ?? undefined,
          location: row.pergola_location ?? undefined,
          pricePerSqm: row.pergola_price_per_sqm ?? 750,
          width: row.pergola_width ?? undefined,
          length: row.pergola_length ?? undefined,
        }

  return {
    pergolas: pergolasFromDb && pergolasFromDb.length > 0 ? pergolasFromDb : undefined,
    pergola: pergolaSingle,
    quickProduct: quickExtra?.quickProduct,
    quickRailings: quickExtra?.quickRailings,
    quickFence: quickExtra?.quickFence,
    quickOfferExtra: quickExtra ?? null,
  }
}

/** Map a full offers row (snake_case) to the Offer type used by PDF / public pages. */
export function transformOfferFromDbRow(data: Record<string, unknown>): Offer {
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
    id: data.id as string,
    dealId: (data.deal_id as string | undefined) ?? '',
    customerName: data.customer_name as string,
    customerPhone: data.customer_phone as string | undefined,
    customerCity: data.customer_city as string | undefined,
    quickProduct: pf.quickProduct,
    quickRailings: pf.quickRailings,
    quickFence: pf.quickFence,
    quickOfferExtra: quickExtra,
    includePergola: quickExtra?.includePergola,
    includeRailings: quickExtra?.includeRailings,
    includeFence: quickExtra?.includeFence,
    pergolas: pf.pergolas,
    pergola: pf.pergola,
    color: {
      type: data.color_type as string,
      ralCode: data.color_ral_code as string | undefined,
      woodName: data.color_wood_name as string | undefined,
    },
    roof: {
      type: data.roof_type as string,
      santafColor: data.roof_santaf_color as string | undefined,
    },
    shadingRatio: data.shading_ratio as Offer['shadingRatio'],
    finishType: data.finish_type as Offer['finishType'],
    finishValue: data.finish_value as string | undefined,
    santaf: {
      enabled: data.santaf_enabled as boolean,
      withStructure: data.santaf_with_structure as boolean,
      pricePerSqmBasic: data.santaf_price_per_sqm_basic as number,
      pricePerSqmWithStructure: data.santaf_price_per_sqm_with_structure as number,
      width:
        !data.pergola_shape_data && data.santaf_enabled && data.pergola_width
          ? Number(data.pergola_width)
          : undefined,
      length:
        !data.pergola_shape_data && data.santaf_enabled && data.pergola_length
          ? Number(data.pergola_length)
          : undefined,
    },
    zipScreen: {
      enabled: data.zip_screen_enabled as boolean,
      type: data.zip_screen_type as string,
      pricePerSqmManual: data.zip_screen_price_per_sqm_manual as number,
      pricePerSqmElectric: data.zip_screen_price_per_sqm_electric as number,
      runningMeters: data.zip_screen_running_meters as number | undefined,
    },
    lighting: {
      enabled: data.lighting_enabled as boolean,
      pricePerMeter: data.lighting_price_per_meter as number,
      runningMeters: data.lighting_running_meters as number | undefined,
    },
    drainage: {
      enabled: data.drainage_enabled as boolean,
      pricePerMeter: data.drainage_price_per_meter as number,
      runningMeters: data.drainage_running_meters as number | undefined,
    },
    winterClosure: {
      enabled: data.winter_closure_enabled as boolean,
      items: (data.winter_closure_items as Offer['winterClosure']['items']) || [],
      glassType: data.winter_closure_glass_type as string | undefined,
    },
    options: {
      notes: data.options_notes as string | undefined,
    },
    area: Number(data.area) || 0,
    pergolaTotal: data.pergola_total as number | undefined,
    railingsLineTotal: quickExtra?.railingsLineTotal,
    fenceLineTotal: quickExtra?.fenceLineTotal,
    santafTotal: Number(data.santaf_total) || 0,
    zipScreenTotal: Number(data.zip_screen_total) || 0,
    lightingTotal: Number(data.lighting_total) || 0,
    drainageTotal: Number(data.drainage_total) || 0,
    winterClosureTotal: Number(data.winter_closure_total) || 0,
    totalBeforeVat: Number(data.total_before_vat) || 0,
    vatPercent: Number(data.vat_percent) || 18,
    vatAmount: Number(data.vat_amount) || 0,
    priceWithVat: Number(data.price_with_vat) || 0,
    discountPercent: Number(data.discount_percent) || 0,
    discountAmount: Number(data.discount_amount) || 0,
    finalPrice: Number(data.final_price) || 0,
    pricing: {
      pergolaTotal: data.pergola_total as number | undefined,
      santafTotal: Number(data.santaf_total) || 0,
      zipScreenTotal: Number(data.zip_screen_total) || 0,
      lightingTotal: Number(data.lighting_total) || 0,
      drainageTotal: Number(data.drainage_total) || 0,
      winterClosureTotal: Number(data.winter_closure_total) || 0,
      totalBeforeVat: Number(data.total_before_vat) || 0,
      vatPercent: Number(data.vat_percent) || 18,
      vatAmount: Number(data.vat_amount) || 0,
      priceWithVat: Number(data.price_with_vat) || 0,
      discountPercent: Number(data.discount_percent) || 0,
      discountAmount: Number(data.discount_amount) || 0,
      finalPrice: Number(data.final_price) || 0,
    },
    paymentTerms: data.payment_terms as Offer['paymentTerms'],
    warranty: data.warranty as Offer['warranty'],
    images: data.images as string[] | undefined,
    configuratorMeta: (data.configurator_meta as Offer['configuratorMeta']) ?? undefined,
    approval: {
      approved: Boolean(data.approved),
      approvedAt: data.approved_at as string | undefined,
      signatureImage: data.signature_image as string | undefined,
      customerName: data.approval_customer_name as string | undefined,
      customerPhone: data.approval_customer_phone as string | undefined,
    },
    pdf: {
      url: data.pdf_url as string | undefined,
      createdAt: data.pdf_created_at as string | undefined,
      locale: data.pdf_locale as string | undefined,
    },
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  } as Offer
}

/**
 * Older quick offers persisted fence/railings in quick_offer_extra but omitted them
 * from total_before_vat. Reconcile so PDF / approve page match WhatsApp totals.
 */
export function reconcileQuickOfferTotals(offer: Offer): Offer {
  const qx = offer.quickOfferExtra
  const fenceLine = qx?.fenceLineTotal ?? offer.fenceLineTotal ?? 0
  const railLine = qx?.railingsLineTotal ?? offer.railingsLineTotal ?? 0
  const missingProductLines = fenceLine + railLine
  if (missingProductLines <= 0) return offer

  const storedBeforeVat = Number(offer.totalBeforeVat) || 0
  const extrasBucket =
    (offer.santafTotal || 0) +
    (offer.lightingTotal || 0) +
    (offer.zipScreenTotal || 0) +
    (offer.drainageTotal || 0) +
    (offer.winterClosureTotal || 0)
  const pergolaPart = offer.pergolaTotal ?? 0
  const sumWithoutExtraProducts = pergolaPart + extrasBucket

  if (Math.abs(storedBeforeVat - sumWithoutExtraProducts) >= 2) return offer

  const totalBeforeVat = storedBeforeVat + missingProductLines
  const vatPct = offer.vatPercent ?? 18
  const vatAmount = totalBeforeVat * (vatPct / 100)
  const priceWithVat = totalBeforeVat + vatAmount
  const discountPct = offer.discountPercent ?? 0
  const discountAmount = priceWithVat * (discountPct / 100)
  const finalPrice = priceWithVat - discountAmount

  return {
    ...offer,
    fenceLineTotal: fenceLine || offer.fenceLineTotal,
    railingsLineTotal: railLine || offer.railingsLineTotal,
    totalBeforeVat,
    vatAmount,
    priceWithVat,
    discountAmount,
    finalPrice,
    pricing: {
      ...offer.pricing,
      totalBeforeVat,
      vatAmount,
      priceWithVat,
      discountAmount,
      finalPrice,
    },
  }
}
