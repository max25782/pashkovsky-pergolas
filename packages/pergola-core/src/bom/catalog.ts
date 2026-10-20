import type { BomCatalog, BomProfile } from './types'

/**
 * In-code BOM catalog (not profiles-store / profiles-api / Supabase).
 * Weights are assumptions — listed in the Stage 13 report. Stock 600 cm.
 */
export const BOM_PROFILE_CATALOG: BomCatalog = {
  '12x4': {
    id: '12x4',
    section: '12x4',
    widthCm: 4,
    heightCm: 12,
    weightKgPerM: 3.2,
    stockLengthCm: 600,
  },
  '2x7': {
    id: '2x7',
    section: '2x7',
    widthCm: 2,
    heightCm: 7,
    weightKgPerM: 0.72,
    stockLengthCm: 600,
  },
  '3x2': {
    id: '3x2',
    section: '3x2',
    widthCm: 2,
    heightCm: 3,
    weightKgPerM: 0.48,
    stockLengthCm: 600,
  },
}

export function resolveProfile(catalog: BomCatalog, profileId: string): BomProfile {
  const profile = catalog[profileId]
  if (!profile) throw new Error(`BOM catalog has no profile "${profileId}"`)
  return profile
}

export function stockLengthCm(catalog: BomCatalog, profileId: string, fallback: number): number {
  return catalog[profileId]?.stockLengthCm ?? fallback
}
