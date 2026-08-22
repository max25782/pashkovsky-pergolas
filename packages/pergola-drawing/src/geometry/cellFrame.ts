import type { CutPiece, Point2D } from '@pashkovsky/pergola-core'
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
 * "Ячейка-рама с вычетами" geometry (Вид А, промпт "рама-вистур") for ONE
 * lamella piece — reconstructs the RAW (pre-vистур) opening the piece's
 * length was cut down from, by extending the piece's own (already-reduced)
 * axis endpoints back out by reductionTotalMm/2 at each end.
 *
 * SCOPE (per clarification — "используй проём между балками, без понятия
 * проём между стойками"): this only ever measures the piece's OWN length
 * axis (face-to-face between the two perimeter beams it runs between).
 * The OTHER вистур clearance — beamSegmentReductionMm, along the
 * post-to-post axis — cuts a PERIMETER BEAM SEGMENT, not a lamella at
 * all (see pergola-core/src/visturTolerances.ts "TWO AXES, TWO PARTS"),
 * so it has no place in this lamella-only cell view; it is wired instead
 * into computeFrame's beam segmentation and belongs on a frame/beam
 * drawing sheet (see the "Схема стоек" pending item), not here.
 *
 * @param piece               A lamella CutPiece. Assumed UN-segmented by a
 *                             purlin (both ends are real contour cuts) —
 *                             the simple, single-span case this first pass
 *                             of "Вид А" targets.
 * @param lengthReductionTotalMm  Same number as
 *                             PergolaSpec.visturTolerances?.lamellaLengthReductionMm
 *                             that computeLamellas already subtracted when
 *                             it built `piece` — passed in explicitly (not
 *                             re-derived from the piece) for the same
 *                             reason lamellaOnEdge is: it is the exact
 *                             parameter the core used, not a second guess.
 *                             0 ⇒ raw === reduced (no vistur clearance was
 *                             ever applied).
 */
export interface CellFrameGeometry {
  rawStart: Point2D
  rawEnd: Point2D
  reducedStart: Point2D
  reducedEnd: Point2D
  /** The clear opening between the two beams BEFORE any vistur clearance was subtracted. */
  rawOpeningMm: number
  /** The piece's own (already reduced) cut length — same as piece.lengthAxisMm. */
  reducedLengthMm: number
  /** How much was trimmed off EACH end, mm — lengthReductionTotalMm / 2. */
  reductionPerEndMm: number
}

export function buildCellFrameGeometry(piece: CutPiece, lengthReductionTotalMm: number): CellFrameGeometry {
  const { start, end } = pieceAxis(piece)
  const axisVec = sub(end, start)
  const axisLen = len(axisVec)
  const dir: Point2D = axisLen > 1e-9 ? scale(axisVec, 1 / axisLen) : [1, 0]
  const reductionPerEndMm = lengthReductionTotalMm / 2

  return {
    rawStart: sub(start, scale(dir, reductionPerEndMm)),
    rawEnd: add(end, scale(dir, reductionPerEndMm)),
    reducedStart: start,
    reducedEnd: end,
    rawOpeningMm: piece.lengthAxisMm + lengthReductionTotalMm,
    reducedLengthMm: piece.lengthAxisMm,
    reductionPerEndMm,
  }
}

/**
 * Picks the MOST REPRESENTATIVE lamella piece for a single "ячейка" plan
 * (Вид А shows exactly one cell) — the longest piece, since the longest
 * span is the one most worth showing the deduction on, and in a simple
 * rectangle every row has the same length anyway (there is no real choice
 * to make there).
 */
export function pickRepresentativeLamella(lamellas: CutPiece[]): CutPiece | null {
  if (lamellas.length === 0) return null
  return lamellas.reduce((best, p) => (p.lengthAxisMm > best.lengthAxisMm ? p : best), lamellas[0])
}
