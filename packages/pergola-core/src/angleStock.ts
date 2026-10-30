import { findPandaAlumBySku } from './supplier/pandaAlum'
import type { CutPiece, ProfileDimensions } from './types'

/** Panda זוית 30/30. Catalog sku p1034, 0.353 kg/m. Ordered only as 6 m bars. */
export const ANGLE_30_PROFILE_ID = 'p1034'
export const ANGLE_STOCK_MM = 6000

/**
 * Length of one 30×30 angle beside a section.
 * H is the section height (crossbar length minus 30 mm, already on the section).
 * Both sides of a trapezoid use this same H. Change this function to retune the cut.
 */
export function angleLengthMm(section: { heightMm: number }): number {
  return section.heightMm
}

export function angleProfileDimensions(): ProfileDimensions {
  const row = findPandaAlumBySku(ANGLE_30_PROFILE_ID)
  const weight = row?.weightKgPerM
  return {
    widthMm: 30,
    heightMm: 30,
    availableStockLengthsMm: [ANGLE_STOCK_MM],
    ...(weight != null && weight > 0 ? { weightKgPerMeter: weight } : {}),
    ...(row?.wallThicknessMm != null ? { wallThicknessMm: row.wallThicknessMm } : {}),
    sku: ANGLE_30_PROFILE_ID,
    labelHe: row?.nameHe ?? 'זוית 30/30',
  }
}

/** Two straight cuts per section, one on each side. */
export function buildAngleCutPieces(
  sections: ReadonlyArray<{ id: string; heightMm: number }>,
  color: string,
): CutPiece[] {
  const pieces: CutPiece[] = []
  for (const section of sections) {
    const length = angleLengthMm(section)
    if (!(length > 0)) continue
    for (const side of ['a', 'b'] as const) {
      pieces.push({
        id: `${section.id}-angle-${side}`,
        role: 'beam',
        profileId: ANGLE_30_PROFILE_ID,
        lengthAxisMm: length,
        lengthLongMm: length,
        lengthShortMm: length,
        cutMiterStartDeg: 0,
        cutBevelStartDeg: 0,
        cutHandStart: 'straight',
        cutMiterEndDeg: 0,
        cutBevelEndDeg: 0,
        cutHandEnd: 'straight',
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        color,
      })
    }
  }
  return pieces
}
