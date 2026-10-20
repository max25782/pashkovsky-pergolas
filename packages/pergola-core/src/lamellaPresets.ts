import { applyLamellaWallThickness, type LamellaWallThicknessMm } from './pergolaProfiles'

export interface LamellaPatternPreset {
  id: string
  pattern: string[]
}

export const LAMELLA_PATTERN_PRESETS: LamellaPatternPreset[] = [
  { id: 'all-20', pattern: ['f2020'] },
  { id: 'all-26', pattern: ['HS013'] },
  { id: 'all-40-09', pattern: ['HS002'] },
  { id: 'all-40', pattern: ['f4020'] },
  { id: 'all-50', pattern: ['F5020'] },
  { id: 'all-70', pattern: ['f7020'] },
  { id: 'mixed-70-40', pattern: ['f7020', 'f4020'] },
  { id: 'mixed-70-40-20', pattern: ['f7020', 'f4020', 'f2020'] },
]

export function resolveLamellaPatternIds(
  id: string,
  wallThicknessMm: LamellaWallThicknessMm = 0.8,
): string[] {
  const found = LAMELLA_PATTERN_PRESETS.find((preset) => preset.id === id)
  const pattern = [...(found ?? LAMELLA_PATTERN_PRESETS[2]).pattern]
  return pattern.map((profileId) => applyLamellaWallThickness(profileId, wallThicknessMm))
}
