import type { Offer, Pergola, PergolaShape, QuickOfferExtraPersisted } from '@/types/offer'

/** Railings/fence quick offers must not reuse default pergola geometry for PDF / plans. */
export function isQuickOfferRailingsOrFenceRow(row: { quick_offer_extra?: unknown }): boolean {
  const ex = row.quick_offer_extra as QuickOfferExtraPersisted | null | undefined
  const qp = ex?.quickProduct
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
