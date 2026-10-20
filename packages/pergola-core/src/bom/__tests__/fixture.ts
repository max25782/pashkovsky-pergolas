import type { BomModel } from '../types'

/** Stage 13 acceptance rectangle: 600×400, frame 12x4, 3 divisions, 44 shade, 4 angles. */
export const ACCEPTANCE_MODEL: BomModel = {
  lengthCm: 600,
  widthCm: 400,
  color: 'anthracite',
  frame: { profileId: '12x4' },
  divisions: { count: 3, profileId: '12x4' },
  shade: { count: 44, profileId: '2x7' },
  angles: { profileId: '3x2' },
}
