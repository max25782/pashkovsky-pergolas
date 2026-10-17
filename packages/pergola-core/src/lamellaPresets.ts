export interface LamellaPatternPreset {
  id: string
  pattern: string[]
}

export const LAMELLA_PATTERN_PRESETS: LamellaPatternPreset[] = [
  { id: 'all-20', pattern: ['f2020'] },
  { id: 'all-40', pattern: ['f4020'] },
  { id: 'all-70', pattern: ['f7020'] },
  { id: 'mixed-70-40', pattern: ['f7020', 'f4020'] },
  { id: 'mixed-70-40-20', pattern: ['f7020', 'f4020', 'f2020'] },
]

export function resolveLamellaPatternIds(id: string): string[] {
  const found = LAMELLA_PATTERN_PRESETS.find((preset) => preset.id === id)
  return [...(found ?? LAMELLA_PATTERN_PRESETS[2]).pattern]
}
