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
  calc?: Pick<OfferCalculation, 'railingsLineTotal' | 'fenceLineTotal'>,
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
  if (inc.fence && draft.quickFence) extra.quickFence = draft.quickFence
  if (calc?.railingsLineTotal != null && calc.railingsLineTotal > 0) {
    extra.railingsLineTotal = calc.railingsLineTotal
  }
  if (calc?.fenceLineTotal != null && calc.fenceLineTotal > 0) {
    extra.fenceLineTotal = calc.fenceLineTotal
  }
  return extra
}

export function resolveQuickOfferIncludesFromExtra(
  ex: QuickOfferExtraPersisted | null | undefined,
): QuickOfferIncludes | null {
  if (!ex) return null
  if (
    ex.includePergola !== undefined ||
    ex.includeRailings !== undefined ||
    ex.includeFence !== undefined
  ) {
    return {
      pergola: ex.includePergola ?? false,
      railings: ex.includeRailings ?? false,
      fence: ex.includeFence ?? false,
    }
  }
  return null
}
