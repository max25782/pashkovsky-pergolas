import {
  FENCE_VARIANT_DEFAULTS,
  type QuickOfferFenceDraft,
  type QuickOfferFenceVariant,
} from '@/types/offer'

/**
 * Patch to apply when the user switches a fence section to another type.
 *
 * The new type's default price and slat gap replace the current ones only when
 * the current value is still the previous type's default (or unset). A value the
 * user typed in by hand is kept, so choosing a type never wipes a manual price.
 */
export function fenceVariantChangePatch(
  fence: Pick<QuickOfferFenceDraft, 'fenceVariant' | 'pricePerSqm' | 'slatGapCm'>,
  next: QuickOfferFenceVariant,
): Partial<QuickOfferFenceDraft> {
  const prev = FENCE_VARIANT_DEFAULTS[fence.fenceVariant]
  const target = FENCE_VARIANT_DEFAULTS[next]
  const patch: Partial<QuickOfferFenceDraft> = { fenceVariant: next }

  if (prev === undefined || !fence.pricePerSqm || fence.pricePerSqm === prev.pricePerSqm) {
    patch.pricePerSqm = target.pricePerSqm
  }
  if (prev === undefined || fence.slatGapCm == null || fence.slatGapCm === prev.slatGapCm) {
    patch.slatGapCm = target.slatGapCm
  }
  return patch
}
