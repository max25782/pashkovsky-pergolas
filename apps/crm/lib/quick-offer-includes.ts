import type {
  OfferCalculation,
  OfferDraft,
  QuickOfferExtraPersisted,
  QuickOfferProductType,
} from '@/types/offer'

export interface QuickOfferIncludes {
  pergola: boolean
  railings: boolean
  fence: boolean
}

/** Resolve which product lines are included (supports legacy single quickProduct). */
export function resolveQuickOfferIncludes(draft: Partial<OfferDraft>): QuickOfferIncludes {
  if (
    draft.includePergola !== undefined ||
    draft.includeRailings !== undefined ||
    draft.includeFence !== undefined
  ) {
    return {
      pergola: draft.includePergola ?? false,
      railings: draft.includeRailings ?? false,
      fence: draft.includeFence ?? false,
    }
  }
  const pk = draft.quickProduct ?? 'pergola'
  return {
    pergola: pk === 'pergola',
    railings: pk === 'railings',
    fence: pk === 'fence',
  }
}

export function primaryQuickProduct(includes: QuickOfferIncludes): QuickOfferProductType {
  const count = [includes.pergola, includes.railings, includes.fence].filter(Boolean).length
  if (count > 1) return 'pergola'
  if (includes.pergola) return 'pergola'
  if (includes.railings) return 'railings'
  if (includes.fence) return 'fence'
  return 'pergola'
}

export function hasAnyQuickOfferProduct(includes: QuickOfferIncludes): boolean {
  return includes.pergola || includes.railings || includes.fence
}

export function usesQuickOfferIncludeFlags(draft: Partial<OfferDraft>): boolean {
  return (
    draft.includePergola !== undefined ||
    draft.includeRailings !== undefined ||
    draft.includeFence !== undefined
  )
}

export function buildQuickOfferExtra(
  draft: Partial<OfferDraft>,
  calc?: Pick<OfferCalculation, 'railingsLineTotal' | 'fenceLineTotal' | 'fenceLineTotals'>,
): QuickOfferExtraPersisted | null {
  const inc = resolveQuickOfferIncludes(draft)
  const hasNewFlags = usesQuickOfferIncludeFlags(draft)
  if (inc.pergola && !inc.railings && !inc.fence && !hasNewFlags) return null

  const extra: QuickOfferExtraPersisted = {
    quickProduct: primaryQuickProduct(inc),
    includePergola: inc.pergola,
    includeRailings: inc.railings,
    includeFence: inc.fence,
  }
  if (inc.railings && draft.quickRailings) extra.quickRailings = draft.quickRailings
  if (inc.fence) {
    const fences = resolveQuickFencesFromDraft(draft)
    if (fences.length > 0) {
      extra.quickFences = fences
      // Keep legacy field for old PDF templates that still read quickFence
      extra.quickFence = fences[0]
    }
  }
  if (calc?.railingsLineTotal != null && calc.railingsLineTotal > 0) {
    extra.railingsLineTotal = calc.railingsLineTotal
  }
  if (calc?.fenceLineTotal != null && calc.fenceLineTotal > 0) {
    extra.fenceLineTotal = calc.fenceLineTotal
  }
  if (calc?.fenceLineTotals && calc.fenceLineTotals.length > 0) {
    extra.fenceLineTotals = calc.fenceLineTotals
  }
  return extra
}

function quickFencesFromExtra(ex: QuickOfferExtraPersisted): QuickOfferExtraPersisted['quickFences'] {
  if (ex.quickFences && ex.quickFences.length > 0) return ex.quickFences
  if (ex.quickFence) return [ex.quickFence]
  return []
}

function hasFenceDataInExtra(ex: QuickOfferExtraPersisted): boolean {
  return quickFencesFromExtra(ex).length > 0 || (ex.fenceLineTotal ?? 0) > 0
}

function hasRailingsDataInExtra(ex: QuickOfferExtraPersisted): boolean {
  return !!ex.quickRailings || (ex.railingsLineTotal ?? 0) > 0
}

export function resolveQuickFencesFromDraft(
  draft: Partial<OfferDraft>,
): NonNullable<QuickOfferExtraPersisted['quickFences']> {
  if (draft.quickFences && draft.quickFences.length > 0) return draft.quickFences
  if (draft.quickFence) return [draft.quickFence]
  return []
}

export function resolveQuickOfferIncludesFromExtra(
  ex: QuickOfferExtraPersisted | null | undefined,
): QuickOfferIncludes | null {
  if (!ex) return null

  const hasFenceData = hasFenceDataInExtra(ex)
  const hasRailingsData = hasRailingsDataInExtra(ex)

  if (
    ex.includePergola !== undefined ||
    ex.includeRailings !== undefined ||
    ex.includeFence !== undefined
  ) {
    return {
      pergola: ex.includePergola ?? false,
      railings: (ex.includeRailings ?? false) || hasRailingsData,
      fence: (ex.includeFence ?? false) || hasFenceData,
    }
  }

  if (ex.quickProduct) {
    return {
      pergola: ex.quickProduct === 'pergola' || hasFenceData || hasRailingsData,
      railings: ex.quickProduct === 'railings' || hasRailingsData,
      fence: ex.quickProduct === 'fence' || hasFenceData,
    }
  }

  if (hasFenceData || hasRailingsData) {
    return {
      pergola: false,
      railings: hasRailingsData,
      fence: hasFenceData,
    }
  }

  return null
}

/** PDF / round-trip: never drop a persisted fence line because flags were missing. */
export function resolvePdfQuickOfferIncludes(
  offer: Pick<OfferDraft, 'includePergola' | 'includeRailings' | 'includeFence' | 'quickProduct'> & {
    quickOfferExtra?: QuickOfferExtraPersisted | null
    quickFence?: OfferDraft['quickFence']
    quickFences?: OfferDraft['quickFences']
    quickRailings?: OfferDraft['quickRailings']
    fenceLineTotal?: number
    railingsLineTotal?: number
    pergola?: OfferDraft['pergola']
    pergolas?: OfferDraft['pergolas']
  },
): QuickOfferIncludes {
  const fromExtra = resolveQuickOfferIncludesFromExtra(offer.quickOfferExtra)
  const base = fromExtra ?? resolveQuickOfferIncludes(offer)
  const qx = offer.quickOfferExtra

  const fences =
    (qx?.quickFences && qx.quickFences.length > 0
      ? qx.quickFences
      : qx?.quickFence
        ? [qx.quickFence]
        : undefined) ??
    (offer.quickFences && offer.quickFences.length > 0
      ? offer.quickFences
      : offer.quickFence
        ? [offer.quickFence]
        : [])

  const hasFenceData =
    fences.length > 0 || (qx?.fenceLineTotal ?? offer.fenceLineTotal ?? 0) > 0
  const hasRailingsData =
    !!(qx?.quickRailings ?? offer.quickRailings) ||
    (qx?.railingsLineTotal ?? offer.railingsLineTotal ?? 0) > 0
  const hasPergolaData = !!(offer.pergolas?.length || offer.pergola?.shape)

  return {
    pergola: base.pergola || hasPergolaData,
    railings: base.railings || hasRailingsData,
    fence: base.fence || hasFenceData,
  }
}
