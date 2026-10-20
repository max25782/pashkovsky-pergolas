import { resolveProfile } from './catalog'
import { DEFAULT_NEST_SETTINGS, mergeNestSettings } from './defaults'
import type { BomModel, BomPart, NestSettings } from './types'

const FRAME_MITER_DEG = 45

function partColor(model: BomModel, override?: string): string {
  return override ?? model.color
}

function miteredFrameLengths(outerCm: number, profileWidthCm: number): {
  lengthCm: number
  lengthLongCm: number
  lengthShortCm: number
} {
  const lengthLongCm = outerCm
  const lengthShortCm = outerCm - 2 * profileWidthCm
  return { lengthCm: lengthLongCm, lengthLongCm, lengthShortCm }
}

/**
 * Logical parts for one rectangular pergola.
 * Frame members: 45° both ends, long = outer side, short = outer − 2×frame width.
 * Division length = inner width (width − 2×frame width). Shade spans lengthCm.
 */
export function buildParts(model: BomModel, settings?: Partial<NestSettings>): BomPart[] {
  const cfg = mergeNestSettings(settings)
  const catalog = cfg.catalog
  const parts: BomPart[] = []

  if (model.lengthCm <= 0 && model.widthCm <= 0 && model.shade.count <= 0 && model.divisions.count <= 0) {
    return parts
  }

  const frameProfile = resolveProfile(catalog, model.frame.profileId)
  const frameColor = partColor(model, model.frame.color)
  const frameWidthCm = frameProfile.widthCm

  const longSides = miteredFrameLengths(model.lengthCm, frameWidthCm)
  const shortSides = miteredFrameLengths(model.widthCm, frameWidthCm)

  if (model.lengthCm > 0) {
    parts.push(framePart('frame-L0', model.frame.profileId, frameColor, longSides))
    parts.push(framePart('frame-L1', model.frame.profileId, frameColor, longSides))
  }
  if (model.widthCm > 0) {
    parts.push(framePart('frame-W0', model.frame.profileId, frameColor, shortSides))
    parts.push(framePart('frame-W1', model.frame.profileId, frameColor, shortSides))
  }

  const divisionProfileId = model.divisions.profileId ?? model.frame.profileId
  const divisionColor = partColor(model, model.divisions.color)
  const innerWidthCm = model.widthCm - 2 * frameWidthCm
  for (let i = 0; i < model.divisions.count; i++) {
    if (innerWidthCm <= 0) continue
    parts.push({
      id: `division-${i}`,
      kind: 'division',
      profileId: divisionProfileId,
      color: divisionColor,
      lengthCm: innerWidthCm,
    })
  }

  const shadeColor = partColor(model, model.shade.color)
  for (let i = 0; i < model.shade.count; i++) {
    if (model.lengthCm <= 0) continue
    parts.push({
      id: `shade-${i}`,
      kind: 'shade',
      profileId: model.shade.profileId,
      color: shadeColor,
      lengthCm: model.lengthCm,
    })
  }

  if (cfg.frameMethod === 'plain_plus_angle' && model.angles) {
    const angleColor = partColor(model, model.angles.color)
    const angleSides = [
      ['angle-L0', model.lengthCm],
      ['angle-L1', model.lengthCm],
      ['angle-W0', model.widthCm],
      ['angle-W1', model.widthCm],
    ] as const
    for (const [id, lengthCm] of angleSides) {
      if (lengthCm <= 0) continue
      parts.push({
        id,
        kind: 'angle',
        profileId: model.angles.profileId,
        color: angleColor,
        lengthCm,
      })
    }
  }

  if (model.posts && model.posts.count > 0 && model.posts.lengthCm > 0) {
    for (let i = 0; i < model.posts.count; i++) {
      parts.push({
        id: `post-${i}`,
        kind: 'hardware',
        profileId: model.posts.profileId,
        color: partColor(model, model.posts.color),
        lengthCm: model.posts.lengthCm,
      })
    }
  }

  return parts
}

function framePart(
  id: string,
  profileId: string,
  color: string,
  lengths: { lengthCm: number; lengthLongCm: number; lengthShortCm: number },
): BomPart {
  return {
    id,
    kind: 'frame',
    profileId,
    color,
    lengthCm: lengths.lengthCm,
    miterStartDeg: FRAME_MITER_DEG,
    miterEndDeg: FRAME_MITER_DEG,
    lengthLongCm: lengths.lengthLongCm,
    lengthShortCm: lengths.lengthShortCm,
  }
}

export function nestLengthCm(part: BomPart): number {
  return part.lengthLongCm ?? part.lengthCm
}

export { DEFAULT_NEST_SETTINGS }
