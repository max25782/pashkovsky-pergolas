import type { Offer } from '@/types/offer'
import type { PergolaParams } from '@pashkovsky/pergola-configurator'

/**
 * Map first rectangle pergola on an offer to 3D package params (meters → cm).
 * If configuratorMeta.params is present (from a previous save), restore all fields from it.
 */
export function offerToConfiguratorInitialParams(offer: Offer): Partial<PergolaParams> | undefined {
  const saved = offer.configuratorMeta?.params
  if (saved) {
    return {
      widthCm: saved.widthCm,
      depthCm: saved.depthCm,
      heightCm: saved.heightCm,
      color: saved.color,
      lamellaAngleDeg: saved.lamellaAngleDeg,
      attachedToWall: saved.attachedToWall,
      lamellaGapCm: saved.lamellaGapCm,
      beamLed: saved.beamLed,
      lamellaStanding: saved.lamellaStanding,
      lamellaAlongWidth: saved.lamellaAlongWidth,
      postProfileId: saved.postProfileId ?? null,
      beamProfileId: saved.beamProfileId ?? null,
      lamellaProfileId: saved.lamellaProfileId ?? null,
    }
  }

  // Fallback: seed only dimensions from the offer's rectangle pergola
  const p = offer.pergolas?.[0] ?? offer.pergola
  if (!p?.shape) return undefined
  if (p.shape.type !== 'rectangle') return undefined
  const w = p.shape.width
  const len = p.shape.length
  const h = p.height ?? 2.6
  return {
    widthCm: Math.round(w * 1000) / 10,
    depthCm: Math.round(len * 1000) / 10,
    heightCm: Math.round(h * 1000) / 10,
  }
}
