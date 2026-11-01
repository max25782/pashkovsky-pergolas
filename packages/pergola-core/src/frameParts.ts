import type { CutPiece, Point2D, ProfileDimensions } from './types'
import {
  computeContourMiters,
  edgeIndicesInCcwOrder,
  isCCW,
  DEFAULT_RIGHT_ANGLE_SNAP_DEG,
  type MiterOptions,
} from './miter'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function vertexLetter(index: number): string {
  if (index < LETTERS.length) return LETTERS[index]
  return `${vertexLetter(Math.floor(index / LETTERS.length) - 1)}${LETTERS[index % LETTERS.length]}`
}

const RAD = Math.PI / 180

function miterOffset(miterDeg: number, profileWidthMm: number): number {
  return Math.tan(miterDeg * RAD) * profileWidthMm / 2
}

function dist(a: Point2D, b: Point2D): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1])
}

export interface FrameEdgePart {
  edgeIndex: number
  edgeLabel: string
  letterFrom: string
  letterTo: string
  isWall: boolean
  axisMm: number
  longMm: number
  shortMm: number
  miterStartDeg: number
  miterEndDeg: number
  profileId: string
}

/**
 * One frame member per contour edge. Same long/short math as computeFrame
 * (non-вистур): Δ = tan(miter) × width/2 at each end.
 */
export function buildFrameEdgeParts(
  contour: Point2D[],
  beamWidthMm: number,
  options?: MiterOptions & { wallEdgeIndices?: number[]; profileId?: string },
): FrameEdgePart[] {
  const pts: Point2D[] = isCCW(contour) ? contour : [...contour].reverse()
  const n = pts.length
  const miters = computeContourMiters(pts, {
    rightAngleSnapDeg: options?.rightAngleSnapDeg ?? DEFAULT_RIGHT_ANGLE_SNAP_DEG,
  })
  // Wall edges are listed in the contour's own order; `pts` may be its reversed copy.
  const walls = new Set(
    (edgeIndicesInCcwOrder(contour, options?.wallEdgeIndices) ?? []).map((i) => ((i % n) + n) % n),
  )
  const profileId = options?.profileId ?? ''
  const parts: FrameEdgePart[] = []
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const axisMm = dist(pts[i], pts[j])
    const mS = Math.abs(miters[i].miterAngleDeg)
    const mE = Math.abs(miters[j].miterAngleDeg)
    const δS = miterOffset(mS, beamWidthMm)
    const δE = miterOffset(mE, beamWidthMm)
    parts.push({
      edgeIndex: i,
      edgeLabel: `${vertexLetter(i)}-${vertexLetter(j)}`,
      letterFrom: vertexLetter(i),
      letterTo: vertexLetter(j),
      isWall: walls.has(i),
      axisMm,
      longMm: axisMm + δS + δE,
      shortMm: axisMm - δS - δE,
      miterStartDeg: mS,
      miterEndDeg: mE,
      profileId,
    })
  }
  return parts
}

export function piecesWeightKg(
  pieces: CutPiece[],
  profiles: Map<string, ProfileDimensions>,
): number {
  let kg = 0
  for (const piece of pieces) {
    const w = profiles.get(piece.profileId)?.weightKgPerMeter
    if (w == null) continue
    kg += (piece.lengthLongMm / 1000) * w
  }
  return kg
}
