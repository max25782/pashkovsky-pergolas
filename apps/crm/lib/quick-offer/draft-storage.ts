import { DEFAULT_OFFER_VALUES, type OfferDraft } from '@/types/offer'
import { normalizePergolas } from '@/lib/pergolas/normalize-pergola'

/** Envelope version for localStorage. A mismatch discards the draft. */
export const QUICK_OFFER_DRAFT_SCHEMA_VERSION = 1

export function quickOfferDraftKey(companyId: string): string {
  return `quick-offer-draft:${companyId}`
}

export interface QuickOfferDraftEnvelope {
  schemaVersion: number
  offerId: string | null
  draft: OfferDraft
}

function buildDefaultDraft(): OfferDraft {
  return {
    dealId: '',
    customerName: 'הצעה מהירה',
    quickProduct: DEFAULT_OFFER_VALUES.quickProduct,
    includePergola: true,
    includeRailings: false,
    includeFence: false,
    quickRailings: { ...DEFAULT_OFFER_VALUES.quickRailings },
    quickFence: { ...DEFAULT_OFFER_VALUES.quickFence },
    pergolas: [{ ...DEFAULT_OFFER_VALUES.pergola }],
    color: { ...DEFAULT_OFFER_VALUES.color },
    roof: { ...DEFAULT_OFFER_VALUES.roof },
    shadingRatio: DEFAULT_OFFER_VALUES.shadingRatio,
    finishType: DEFAULT_OFFER_VALUES.finishType,
    finishValue: DEFAULT_OFFER_VALUES.finishValue,
    santaf: { ...DEFAULT_OFFER_VALUES.santaf },
    zipScreen: { ...DEFAULT_OFFER_VALUES.zipScreen },
    lighting: { ...DEFAULT_OFFER_VALUES.lighting },
    drainage: { ...DEFAULT_OFFER_VALUES.drainage },
    winterClosure: { ...DEFAULT_OFFER_VALUES.winterClosure },
    options: { ...DEFAULT_OFFER_VALUES.options },
    vatPercent: DEFAULT_OFFER_VALUES.vatPercent,
    discountPercent: 0,
    images: [],
  }
}

export function serializeQuickOfferDraft(draft: OfferDraft, offerId: string | null): string {
  const envelope: QuickOfferDraftEnvelope = {
    schemaVersion: QUICK_OFFER_DRAFT_SCHEMA_VERSION,
    offerId,
    draft,
  }
  return JSON.stringify(envelope)
}

/**
 * Restore a stored draft. Broken JSON or a different schemaVersion → null
 * (caller keeps the empty form). Pergolas go through normalizePergolas.
 */
export function parseQuickOfferDraft(raw: string | null): { draft: OfferDraft; offerId: string | null } | null {
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const envelope = parsed as Record<string, unknown>
  if (envelope.schemaVersion !== QUICK_OFFER_DRAFT_SCHEMA_VERSION) return null
  if (!envelope.draft || typeof envelope.draft !== 'object') return null

  const base = buildDefaultDraft()
  const incoming = envelope.draft as Partial<OfferDraft>
  const pergolas = normalizePergolas(incoming.pergolas)
  const offerId = typeof envelope.offerId === 'string' && envelope.offerId.length > 0 ? envelope.offerId : null

  return {
    offerId,
    draft: {
      ...base,
      ...incoming,
      pergolas: pergolas ?? base.pergolas,
      color: incoming.color ?? base.color,
      roof: incoming.roof ?? base.roof,
      santaf: incoming.santaf ?? base.santaf,
      zipScreen: incoming.zipScreen ?? base.zipScreen,
      lighting: incoming.lighting ?? base.lighting,
      drainage: incoming.drainage ?? base.drainage,
      winterClosure: incoming.winterClosure ?? base.winterClosure,
      options: incoming.options ?? base.options,
      quickRailings: incoming.quickRailings ?? base.quickRailings,
      quickFence: incoming.quickFence ?? base.quickFence,
    },
  }
}

export function quickOfferSubmitTarget(offerId: string | null): { url: string; method: 'POST' | 'PATCH' } {
  if (offerId) return { url: `/api/quick-offer/${offerId}`, method: 'PATCH' }
  return { url: '/api/quick-offer', method: 'POST' }
}
