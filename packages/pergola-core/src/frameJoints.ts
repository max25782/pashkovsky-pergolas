/**
 * Frame end joints from wall flags and the interior angle.
 * Not stored on the plan. `frameJointVersion === 1` opts in; unset keeps
 * the previous "miter every corner" lengths so saved plans stay put.
 *
 * Free + free, or wall + wall: bisector miter (45° when the corner is 90°).
 * The ordered length is the long (outer) edge.
 * Free meeting a wall: the free beam runs to the wall, that end is 90°,
 * even when the corner is not a right angle.
 * Wall meeting a free side: the wall beam sits between the side beams,
 * that end is 90°, and the outer length loses the side beam's full width.
 */

export const FRAME_JOINT_VERSION = 1 as const
export type FrameJointVersion = typeof FRAME_JOINT_VERSION

const RAD = Math.PI / 180
/** Interior this close to 90° or 270° is a right angle. */
const RIGHT_ANGLE_TOL_DEG = 1.5

export type FrameEndKind = 'miter' | 'square-to-wall' | 'square-between'

export interface FrameEndJoint {
  kind: FrameEndKind
  /** Degrees from perpendicular. 0 is a square cut. */
  cutDeg: number
  /** Subtracted from the typed outer length. Full neighbor width only for square-between. */
  outerTrimMm: number
  neighborWidthMm: number
  /** Wall meets a free side, and the corner is not a right angle. */
  skew: boolean
}

export function isRightAngleInterior(interiorDeg: number): boolean {
  return Math.abs(interiorDeg - 90) <= RIGHT_ANGLE_TOL_DEG
    || Math.abs(interiorDeg - 270) <= RIGHT_ANGLE_TOL_DEG
}

export function frameEndJoint(input: {
  edgeIsWall: boolean
  neighborIsWall: boolean
  interiorDeg: number
  neighborWidthMm: number
}): FrameEndJoint {
  const neighbor = input.neighborWidthMm > 0 ? input.neighborWidthMm : 0
  const miter = Math.abs((180 - input.interiorDeg) / 2)
  const skew = !isRightAngleInterior(input.interiorDeg)
  if (input.edgeIsWall === input.neighborIsWall) {
    return { kind: 'miter', cutDeg: miter, outerTrimMm: 0, neighborWidthMm: neighbor, skew: false }
  }
  if (!input.edgeIsWall && input.neighborIsWall) {
    return { kind: 'square-to-wall', cutDeg: 0, outerTrimMm: 0, neighborWidthMm: neighbor, skew }
  }
  return { kind: 'square-between', cutDeg: 0, outerTrimMm: neighbor, neighborWidthMm: neighbor, skew }
}

function miterHalfDeltaMm(cutDeg: number, beamWidthMm: number): number {
  return Math.tan(Math.abs(cutDeg) * RAD) * beamWidthMm / 2
}

/**
 * Ordered beam length.
 * With a typed outer, a miter end keeps the outer corner and a square-between
 * end drops the neighbor's full width.
 * Without an outer, the contour is the centerline: a miter adds the long-point
 * delta, a square-to-wall reaches the neighbor's outer face (half width),
 * and a square-between stops on the neighbor's inner face (half width).
 */
export function beamCutLengths(input: {
  outerMm: number | null
  axisMm: number
  beamWidthMm: number
  start: FrameEndJoint
  end: FrameEndJoint
}): { longMm: number; shortMm: number } {
  const dStart = miterHalfDeltaMm(input.start.cutDeg, input.beamWidthMm)
  const dEnd = miterHalfDeltaMm(input.end.cutDeg, input.beamWidthMm)
  let longMm: number
  if (input.outerMm != null && input.outerMm > 0) {
    longMm = input.outerMm - input.start.outerTrimMm - input.end.outerTrimMm
  } else {
    const extend = (joint: FrameEndJoint, miterDelta: number) => {
      if (joint.kind === 'miter') return miterDelta
      if (joint.kind === 'square-to-wall') return joint.neighborWidthMm / 2
      return -joint.neighborWidthMm / 2
    }
    longMm = input.axisMm + extend(input.start, dStart) + extend(input.end, dEnd)
  }
  return { longMm, shortMm: longMm - 2 * dStart - 2 * dEnd }
}

export interface SkewWallFreeCorner {
  vertexIndex: number
  wallEdgeIndex: number
  freeEdgeIndex: number
  interiorDeg: number
}

/** Corners where a wall side meets a free side that is not perpendicular. */
export function skewWallFreeCorners(input: {
  edgeCount: number
  isWall: (edgeIndex: number) => boolean
  interiorDegAt: (vertexIndex: number) => number
}): SkewWallFreeCorner[] {
  const found: SkewWallFreeCorner[] = []
  const n = input.edgeCount
  for (let vertex = 0; vertex < n; vertex++) {
    const incoming = (vertex + n - 1) % n
    const outgoing = vertex
    const inWall = input.isWall(incoming)
    const outWall = input.isWall(outgoing)
    if (inWall === outWall) continue
    const interiorDeg = input.interiorDegAt(vertex)
    if (isRightAngleInterior(interiorDeg)) continue
    found.push({
      vertexIndex: vertex,
      wallEdgeIndex: inWall ? incoming : outgoing,
      freeEdgeIndex: inWall ? outgoing : incoming,
      interiorDeg,
    })
  }
  return found
}
