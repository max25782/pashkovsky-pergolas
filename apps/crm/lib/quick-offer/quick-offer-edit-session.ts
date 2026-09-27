/**
 * Quick-offer UX when localStorage still holds an offerId after submit.
 * Form stays locked until the user acknowledges the "editing existing offer" banner.
 */
export function isQuickOfferFormBlocked(editingOfferId: string | null, sessionAcknowledged: boolean): boolean {
  return editingOfferId !== null && editingOfferId.length > 0 && !sessionAcknowledged
}

export function shouldWarnQuickOfferCustomerRename(
  editingOfferId: string | null,
  boundCustomerName: string,
  nextCustomerName: string,
): boolean {
  if (!editingOfferId) return false
  const a = boundCustomerName.trim()
  const b = nextCustomerName.trim()
  if (!a || !b) return false
  return a !== b
}
