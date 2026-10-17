/**
 * RAL Classic → sRGB hex. Data table only — components must not hardcode
 * individual RAL swatches. Sources: RAL Classic public colour list
 * (approximate sRGB conversions used by architectural visualisation).
 */
export const RAL_HEX: Record<string, string> = {
  RAL1001: '#C2B078',
  RAL1013: '#E3D9C6',
  RAL1015: '#E6D2B5',
  RAL3004: '#6B1C23',
  RAL5008: '#2E3A44',
  RAL6005: '#0E4438',
  RAL7004: '#969992',
  RAL7012: '#4E5754',
  RAL7015: '#3E424B',
  RAL7016: '#383E42',
  RAL7021: '#2F3234',
  RAL7024: '#45494E',
  RAL7035: '#C5C7C4',
  RAL7040: '#82898E',
  RAL8014: '#4A3526',
  RAL8017: '#44322D',
  RAL8019: '#3D3635',
  RAL8022: '#1A1718',
  RAL9005: '#0A0A0A',
  RAL9006: '#A1A1A0',
  RAL9007: '#8F8F8C',
  RAL9010: '#F1EDE1',
  RAL9011: '#1B1B1B',
  RAL9016: '#F4F4F4',
}

const RAL_KEY = /^RAL\s*(\d{4})$/i

export function normalizeRalKey(token: string): string | null {
  const match = token.trim().match(RAL_KEY)
  return match ? `RAL${match[1]}` : null
}

export function ralToHex(token: string): string | null {
  const key = normalizeRalKey(token)
  if (key == null) return null
  return RAL_HEX[key] ?? null
}

export function isHexColor(token: string): boolean {
  return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(token.trim())
}
