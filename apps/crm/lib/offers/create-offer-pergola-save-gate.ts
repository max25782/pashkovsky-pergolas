import { calculatePergolaArea, validatePergolaShape } from '@/lib/calculations/pergola-area'
import type { Pergola } from '@/types/offer'

export type CreateOfferPergolaSaveBlockReason = 'missing_shape' | 'invalid_shape'

/**
 * Create-offer modal uses legacy shape dimensions (no plan editor).
 * Saving with shape:null would store area 0 — block until a valid shape is chosen.
 */
export function getCreateOfferPergolaSaveBlock(pergolas: Pergola[]): CreateOfferPergolaSaveBlockReason | null {
  for (const pergola of pergolas) {
    if (!pergola.shape) return 'missing_shape'
    const validation = validatePergolaShape(pergola.shape)
    if (!validation.valid || calculatePergolaArea(pergola.shape) <= 0) return 'invalid_shape'
  }
  return null
}

export function isCreateOfferPergolaSaveDisabled(pergolas: Pergola[]): boolean {
  if (pergolas.length === 0) return true
  return getCreateOfferPergolaSaveBlock(pergolas) !== null
}
