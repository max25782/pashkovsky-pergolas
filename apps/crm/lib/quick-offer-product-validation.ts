import type { OfferDraft } from '@/types/offer'
import { GATE_STANDARD_MAX_WIDTH_CM, GATE_STANDARD_MAX_HEIGHT_CM } from '@/types/offer'

export function validateQuickRailings(draft: Partial<OfferDraft>): string | null {
  const qr = draft.quickRailings
  if (!qr) return 'quickRailings is required'
  if (!qr.metersTotal || Number(qr.metersTotal) <= 0) return 'Railings: meters must be > 0'
  if (qr.heightCm == null || Number(qr.heightCm) <= 0) return 'Railings: height (cm) required for m² pricing'
  if (!qr.profileType?.trim()) return 'Railings: profile is required'
  if (!qr.color?.trim()) return 'Railings: color is required'
  if (!qr.locationType) return 'Railings: location is required'
  const gs = String(qr.glazingSystem ?? '').trim()
  if (!['aluminum_glass', 'wet_glazing', 'dry_glazing'].includes(gs)) {
    return 'Railings: glazing system is required'
  }
  return null
}

export function validateQuickFence(draft: Partial<OfferDraft>): string | null {
  // Support new quickFences array; fall back to legacy quickFence
  const fences =
    draft.quickFences && draft.quickFences.length > 0
      ? draft.quickFences
      : draft.quickFence ? [draft.quickFence] : []
  if (fences.length === 0) return 'quickFence is required'
  for (let i = 0; i < fences.length; i++) {
    const qf = fences[i]
    const label = fences.length > 1 ? ` (section ${i + 1})` : ''
    if (!qf.metersTotal || Number(qf.metersTotal) <= 0) return `Fence${label}: meters must be > 0`
    if (qf.heightCm == null || Number(qf.heightCm) <= 0) return `Fence${label}: height (cm) required for m² pricing`
    const fv = String(qf.fenceVariant ?? '').trim()
    if (!['classic', 'hitech', 'hitech_angular'].includes(fv)) return `Fence${label}: variant is required`
    if (!qf.color?.trim()) return `Fence${label}: color is required`

    // Validate gates in this section
    for (let gi = 0; gi < (qf.gates ?? []).length; gi++) {
      const gate = qf.gates![gi]
      const gl = `${label ? label.slice(0, -1) + ', ' : '('}gate ${gi + 1})`
      if (!gate.widthCm || Number(gate.widthCm) <= 0) return `Fence${gl}: gate width (cm) required`
      if (!gate.heightCm || Number(gate.heightCm) <= 0) return `Fence${gl}: gate height (cm) required`
      const isNonStd =
        Number(gate.widthCm) > GATE_STANDARD_MAX_WIDTH_CM ||
        Number(gate.heightCm) > GATE_STANDARD_MAX_HEIGHT_CM
      if (isNonStd && (gate.pricePerUnit == null || Number(gate.pricePerUnit) <= 0)) {
        return `Fence${gl}: מידה לא סטנדרטית — המחיר נקבע ידנית`
      }
    }
  }
  return null
}
