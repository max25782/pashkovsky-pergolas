import type { CutPiece, ProfileDimensions, Point2D } from '@pashkovsky/pergola-core'
import { pieceAxis } from '@pashkovsky/pergola-core'

function sub(a: Point2D, b: Point2D): Point2D {
  return [a[0] - b[0], a[1] - b[1]]
}
function add(a: Point2D, b: Point2D): Point2D {
  return [a[0] + b[0], a[1] + b[1]]
}
function scale(a: Point2D, s: number): Point2D {
  return [a[0] * s, a[1] * s]
}
function len(a: Point2D): number {
  return Math.sqrt(a[0] * a[0] + a[1] * a[1])
}

/**
 * Plan-view footprint rectangle of a beam or purlin: a simple axis-aligned
 * (relative to the piece's own axis) rectangle, `profile.widthMm` wide
 * (perpendicular to the axis — see ProfileDimensions.widthMm: "the
 * HORIZONTAL, in-plan dimension" for these roles) running the piece's full
 * `lengthAxisMm`.
 *
 * DELIBERATE SIMPLIFICATION for the first "План сверху" pass: corners are
 * square-cut at both ends (ignores cutMiterStartDeg/cutMiterEndDeg — the
 * actual mitred long/short points from lengthLongMm/lengthShortMm). A plan
 * view built from centerlines only is still exact for axial dimensioning
 * (which is centerline-to-centerline by definition); true mitred corners
 * only matter once "в свету" (clear-opening, face-to-face) rendering is
 * built — deferred along with that.
 */
export function beamFootprintCorners(piece: CutPiece, profile: ProfileDimensions): Point2D[] {
  return axisAlignedFootprintCorners(piece, profile.widthMm)
}

/**
 * Plan-view footprint rectangle of a LAMELLA — same axis-aligned rectangle
 * shape as beamFootprintCorners, but the perpendicular width is the row's
 * VISIBLE width, which depends on lamellaOnEdge (see
 * pergola-core lamellaPattern.ts resolveLamellaPattern: visibleWidthMm =
 * lamellaOnEdge ? profile.heightMm : profile.widthMm — profile.widthMm
 * alone would draw an onEdge row on its FLAT footprint, silently
 * contradicting the very core calculation this drawing is supposed to
 * mirror 1:1).
 */
export function lamellaFootprintCorners(piece: CutPiece, profile: ProfileDimensions, lamellaOnEdge: boolean): Point2D[] {
  const visibleWidthMm = lamellaOnEdge ? profile.heightMm : profile.widthMm
  return axisAlignedFootprintCorners(piece, visibleWidthMm)
}

function axisAlignedFootprintCorners(piece: CutPiece, widthMm: number): Point2D[] {
  const { start, end } = pieceAxis(piece)
  const axisVec = sub(end, start)
  const axisLen = len(axisVec)
  const dir: Point2D = axisLen > 1e-9 ? scale(axisVec, 1 / axisLen) : [1, 0]
  const perp: Point2D = [-dir[1], dir[0]]
  const halfWidth = scale(perp, widthMm / 2)

  return [add(start, halfWidth), add(end, halfWidth), sub(end, halfWidth), sub(start, halfWidth)]
}

/**
 * Plan-view footprint rectangle of a post: axis-aligned in WORLD (not
 * piece-local) X/Z, because computeFrame always emits rotation = [0,0,0]
 * for posts (see frame.ts) — there is no azimuth to rotate the footprint
 * by.
 *
 * SIZE, per geometryBuilder.ts's own documented post transform (canonical
 * box built with length=lengthAxisMm on X, width=profile.widthMm on Z
 * centered, height=profile.heightMm on Y centered, THEN the whole box is
 * rotated +90° about Z before position/rotation is applied): rotateZ(+90°)
 * maps local (x, y, z) → (−y, x, z), so the piece's ORIGINAL local-Y span
 * (profile.heightMm, centered) becomes the new local/world-X span, while Z
 * (profile.widthMm, centered) is untouched. The post's footprint in the
 * X/Z plan is therefore heightMm (world X) × widthMm (world Z) — NOT
 * widthMm × widthMm, and NOT the same width/height convention as a beam
 * (see ProfileDimensions class docstring: for a post role, BOTH catalog
 * fields end up horizontal/in-plan; there is no vertical cross-section
 * dimension left to draw, the post's own vertical extent is
 * lengthAxisMm).
 *
 * KNOWN GAP (flagged to the user, deferred — not needed for the axial
 * sheet): for a non-square post (e.g. 100×40) this footprint's two sides
 * are NOT interchangeable, and computeFrame has no field describing which
 * side a given post is turned to face which neighbouring edge. Fine for
 * this rectangle's own area/shape; will matter once "в свету" dimensions
 * are added for the post-scheme sheet.
 */
export function postFootprintCorners(piece: CutPiece, profile: ProfileDimensions): Point2D[] {
  const { start: center } = pieceAxis(piece)
  const hx = profile.heightMm / 2
  const hz = profile.widthMm / 2
  return [
    [center[0] - hx, center[1] - hz],
    [center[0] + hx, center[1] - hz],
    [center[0] + hx, center[1] + hz],
    [center[0] - hx, center[1] + hz],
  ]
}
