import type { CutPiece, Point2D } from './types'

export interface PieceAxis {
  /** Start of the piece's centerline in plan, mm. For role 'post', equals `end` (a single point — see below). */
  start: Point2D
  /** End of the piece's centerline in plan, mm. For role 'post', equals `start`. */
  end: Point2D
}

/**
 * Recover a CutPiece's plan-view centerline (or, for a post, its single axis
 * point) directly from the SAME numeric fields the geometry builder already
 * consumes — position/rotation/lengthAxisMm (see geometryBuilder.ts's own
 * class-level docstring for the position/rotation convention this depends
 * on). This is deliberately NOT a new source of geometry: it reads exactly
 * what frame.ts/lamellas.ts/purlins.ts wrote when they built the piece, so a
 * technical drawing derived from it can never disagree with the 3D scene or
 * the cut list (see prompt "чертёж... из того же CutPiece[]... один источник
 * правды").
 *
 * PLAN MAPPING: every producer maps plan (x, y) → world (x, heightMm, y) —
 * see each one's own "plan (x, y) → world (x, heightMm, y)" comment — so
 * position[0]/position[2] (world X/Z) map straight back to plan (x, y).
 *
 * DIRECTION: for every non-post role, the plan direction angle is
 * θ = −rotation[1]. This holds EVEN for a tilted lamella (rotation[0] ≠ 0,
 * see lamellas.ts effectiveTiltDeg): Three.js applies Euler rotations in
 * XYZ order, so rotation.x (the tilt, about the piece's OWN local X/length
 * axis) is applied first and, by definition, cannot move the local X axis
 * itself — rotation.y (azimuth) is what actually swings the length axis
 * into its plan direction (cos θ, sin θ) in the XZ-plane, exactly as
 * documented in geometryBuilder.ts's own proof of this convention.
 *
 * POSTS: frame.ts always emits rotation = [0, 0, 0] for posts (they are
 * vertical, plan-symmetric members — see frame.ts computeFrame), and their
 * cross-section is built centered on the local origin (zMode: 'centered' in
 * geometryBuilder.ts), so position ALREADY IS the axis point in plan — no
 * direction to derive, no offset to undo.
 */
export function pieceAxis(piece: CutPiece): PieceAxis {
  const start: Point2D = [piece.position[0], piece.position[2]]

  if (piece.role === 'post') {
    return { start, end: start }
  }

  const theta = -piece.rotation[1]
  const end: Point2D = [
    start[0] + piece.lengthAxisMm * Math.cos(theta),
    start[1] + piece.lengthAxisMm * Math.sin(theta),
  ]
  return { start, end }
}
