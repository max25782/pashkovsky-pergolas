/**
 * "Вистур" is not a distinct part — it is a MANUFACTURING METHOD: the whole
 * pergola (or one cell of it) is welded into a finished frame AT THE
 * FACTORY and delivered assembled, instead of being fitted piece-by-piece
 * on site. Because the frame is welded closed before delivery, its own
 * INTERNAL pieces must be cut SMALLER than the opening they sit in —
 * otherwise the frame could never be welded up in the first place. These
 * are factory ASSEMBLY clearances, not a structural rule: different
 * shops/profiles use different numbers, so they are a configurable
 * parameter, never a hardcoded constant (see prompt "Вынести в конфиг
 * рядом с остальными допусками").
 *
 * THE FRAME HAS TWO AXES, EACH WITH ITS OWN CLEARANCE, ON TWO DIFFERENT
 * PARTS (clarified in chat after the original wording — "ширина ламели"
 * — turned out to be a red herring: a lamella's cross-section width is a
 * fixed catalog dimension (20/40/70mm) that can never be trimmed):
 *
 *   • Along the span BETWEEN POSTS (perpendicular to the lamellas, the
 *     "width" axis of the frame): the piece that gets welded into that
 *     gap is a PERIMETER BEAM SEGMENT — under вистур the beam over one
 *     polygon edge is no longer a single post-to-post-to-post run (the
 *     pre-existing, non-вистур behaviour), it is split into one welded
 *     segment PER BAY (between each pair of adjacent posts), exactly like
 *     a lamella gets split at purlin crossings. Each such segment is cut
 *     beamSegmentReductionMm SHORTER than the raw post-to-post span so the
 *     welded sub-frame can actually be dropped into place — see
 *     applyVisturBeamSegmentReductionMm, wired into computeFrame.
 *   • Along the span BETWEEN BEAMS (parallel to the lamellas, the
 *     "length" axis of the frame): the piece that gets welded shorter is
 *     the LAMELLA itself — its own length (beam-face to beam-face, the
 *     axis it already runs along) is cut lamellaLengthReductionMm shorter
 *     — see applyVisturLengthReductionMm, wired into computeLamellas.
 *
 * A POST is never shortened by either clearance — it is the fixed
 * reference the welded sub-frames are dropped between, not a piece cut to
 * fit inside anything.
 *
 * SCOPE: this only ever applies when a spec explicitly opts in
 * (PergolaSpec.visturTolerances is set) — undefined ⇒ the pergola is
 * assembled on site piece-by-piece, exactly the pre-existing behaviour with
 * zero change to any already-shipped length calculation (see
 * computeLamellas'/computeFrame's STRICT undefined-⇒no-op contract, same
 * pattern as purlinProfileId/lamellaPattern/wallEdgeIndices elsewhere in
 * this module).
 */

export interface VisturTolerances {
  /**
   * mm subtracted TOTAL (both ends combined, i.e. /2 off each end that
   * meets a post — see computeFrame) from the raw post-to-post span of a
   * PERIMETER BEAM SEGMENT (one welded bay, вистур mode only) to get its
   * cut length. Default 15 — see prompt example "проём 1300 → деталь
   * 1285". This is a BEAM dimension, never a lamella's cross-section
   * width (that is fixed by the catalog profile and never reduced).
   */
  beamSegmentReductionMm: number
  /**
   * mm subtracted TOTAL (both ends combined — see applyVisturLengthReductionMm)
   * from a lamella's face-to-face span to get its cut LENGTH. Default 30 =
   * 15mm per end — see prompt example "внутренняя грань-грань 2000 → длина
   * ламели 1970".
   */
  lamellaLengthReductionMm: number
}

export const DEFAULT_VISTUR_TOLERANCES: VisturTolerances = {
  beamSegmentReductionMm: 15,
  lamellaLengthReductionMm: 30,
}

/**
 * Vistur PERIMETER BEAM SEGMENT length = raw post-to-post span −
 * beamSegmentReductionMm.
 *
 * See prompt example: rawSpanMm=1300, default tolerances ⇒ 1285.
 *
 * Wired into computeFrame: under вистур mode a beam is split into one
 * segment per bay (between adjacent posts along its edge) and EACH such
 * segment loses beamSegmentReductionMm/2 off BOTH ends (both ends always
 * meet a post — unlike the lamella case there is no "internal, untouched"
 * boundary here, every segment boundary in this axis IS a post).
 */
export function applyVisturBeamSegmentReductionMm(
  rawSpanMm: number,
  tolerances: VisturTolerances = DEFAULT_VISTUR_TOLERANCES,
): number {
  return rawSpanMm - tolerances.beamSegmentReductionMm
}

/**
 * Vistur lamella LENGTH = face-to-face span − lamellaLengthReductionMm
 * (total, both ends combined — i.e. lamellaLengthReductionMm / 2 off each
 * end, see computeLamellas' wiring: only the TWO ends that actually meet
 * the frame's own outer perimeter beam are retracted; an internal
 * purlin-crossing straight cut is untouched, since that joint is inside
 * the same welded frame, not at its outer boundary).
 *
 * See prompt example: faceToFaceMm=2000, default tolerances ⇒ 1970.
 */
export function applyVisturLengthReductionMm(
  faceToFaceMm: number,
  tolerances: VisturTolerances = DEFAULT_VISTUR_TOLERANCES,
): number {
  return faceToFaceMm - tolerances.lamellaLengthReductionMm
}
