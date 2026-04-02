import type { PergolaParams } from './types'

export function defaultPergolaParams(initial?: Partial<PergolaParams>): PergolaParams {
  return {
    widthCm: initial?.widthCm ?? 400,
    depthCm: initial?.depthCm ?? 350,
    heightCm: initial?.heightCm ?? 260,
    color: initial?.color ?? '#9aa0a6',
    lamellaAngleDeg: initial?.lamellaAngleDeg ?? 0,
    attachedToWall: initial?.attachedToWall ?? false,
    lamellaGapCm: initial?.lamellaGapCm ?? 2,
    beamLed: initial?.beamLed ?? false,
    lamellaStanding: initial?.lamellaStanding ?? false,
    lamellaAlongWidth: initial?.lamellaAlongWidth ?? false,
    postProfileId: initial?.postProfileId ?? null,
    beamProfileId: initial?.beamProfileId ?? 'f10040',
    dividerProfileId: initial?.dividerProfileId ?? null,
    lamellaProfileId: initial?.lamellaProfileId ?? 'f10020',
  }
}
