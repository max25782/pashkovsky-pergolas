import type { OfferDraft, Pergola } from '@/types/offer'
import { normalizePergola, normalizePergolas } from '@/lib/pergolas/normalize-pergola'
import { validatePergolaPlanForApi } from '@/lib/pergolas/validate-pergola-plan'

export type PreparePergolasResult =
  | { ok: true; pergolas: Pergola[] }
  | { ok: false; error: string }

/**
 * Normalize draft pergolas and validate any non-null plan (POST/PATCH quick-offer).
 */
function rawPlanField(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return undefined
  return (raw as Record<string, unknown>).plan
}

export function prepareQuickOfferPergolas(draft: Partial<OfferDraft>): PreparePergolasResult {
  const rawList = draft.pergolas
  if (Array.isArray(rawList) && rawList.length > 0) {
    const pergolas: Pergola[] = []
    for (let i = 0; i < rawList.length; i++) {
      const raw = rawList[i]
      const base = normalizePergola(raw)
      const planField = rawPlanField(raw)
      if (planField !== null && planField !== undefined) {
        const check = validatePergolaPlanForApi(planField)
        if (!check.ok) {
          return { ok: false, error: `Pergola ${i + 1}: ${check.error}` }
        }
        pergolas.push({ ...base, plan: check.plan })
      } else {
        pergolas.push(base)
      }
    }
    return { ok: true, pergolas }
  }

  if (draft.pergola) {
    const one = normalizePergola(draft.pergola)
    const planField = rawPlanField(draft.pergola)
    if (planField !== null && planField !== undefined) {
      const check = validatePergolaPlanForApi(planField)
      if (!check.ok) return { ok: false, error: check.error }
      return { ok: true, pergolas: [{ ...one, plan: check.plan }] }
    }
    return { ok: true, pergolas: [one] }
  }

  const fromArray = normalizePergolas(rawList)
  return { ok: true, pergolas: fromArray ?? [] }
}
