import * as THREE from 'three'
import { isHexColor, ralToHex } from './ral'

export type PergolaFinish = 'aluminum' | 'wood'

export interface ResolvedPergolaFinish {
  finish: PergolaFinish
  hex: string
  metalness: number
  roughness: number
}

export const WOOD_PRESETS: Record<string, string> = {
  wood: '#8B5A2B',
  'wood:oak': '#C4A574',
  'wood:teak': '#6B4226',
  'wood:walnut': '#5C4033',
}

const ALUMINUM = { metalness: 0.9, roughness: 0.35 }
const WOOD = { metalness: 0.0, roughness: 0.72 }
const FALLBACK_HEX = '#9aa0a6'

export function resolvePergolaFinish(colorHex: string | undefined): ResolvedPergolaFinish {
  const token = (colorHex ?? '').trim()
  const woodKey = token.toLowerCase()
  if (woodKey in WOOD_PRESETS) {
    return { finish: 'wood', hex: WOOD_PRESETS[woodKey], ...WOOD }
  }
  const ral = ralToHex(token)
  if (ral != null) {
    return { finish: 'aluminum', hex: ral, ...ALUMINUM }
  }
  if (isHexColor(token)) {
    return { finish: 'aluminum', hex: token, ...ALUMINUM }
  }
  return { finish: 'aluminum', hex: FALLBACK_HEX, ...ALUMINUM }
}

export function buildPergolaMaterial(colorHex: string | undefined): THREE.MeshStandardMaterial {
  const resolved = resolvePergolaFinish(colorHex)
  return new THREE.MeshStandardMaterial({
    color: resolved.hex,
    metalness: resolved.metalness,
    roughness: resolved.roughness,
    envMapIntensity: resolved.finish === 'aluminum' ? 1.1 : 0.45,
  })
}
