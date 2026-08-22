import type { CutPiece, ProfileDimensions } from './types'

/**
 * Structural validation — a pergola spec can be geometrically well-formed
 * (computeFrame/computeLamellas/computePurlins all return without throwing)
 * and STILL describe a physically unbuildable structure: e.g. a 6m lamella
 * run with maxLamellaSpanMm = 1500mm and no interrupting purlin sags in the
 * middle, but nothing upstream currently stops the spec from being priced
 * and rendered as if it were fine (see prompt "дефолт NO_PURLIN... выдаёт
 * неисполнимую конструкцию молча").
 *
 * This is deliberately checked AFTER the pieces are built, not by predicting
 * the span up front: computeLamellas already knows the true per-piece
 * unsupported length (it may be shorter than the naive row length whenever a
 * purlin interrupts it), so re-deriving that here from spec + profiles alone
 * would duplicate — and risk diverging from — the segmentation logic that
 * lives in computeLamellas/purlins.ts. Checking the actual CutPiece[] output
 * is the single source of truth for "how long is this piece really left
 * unsupported", by construction.
 */

export interface StructuralIssue {
  code: 'lamella-span-exceeds-max'
  message: string
  pieceId: string
  profileId: string
  spanMm: number
  maxSpanMm: number
}

/** Piece lengths are computed in floating point (miter offsets, scan steps); a hair over the limit is not a real violation. */
const SPAN_EPSILON_MM = 0.5

/**
 * Check every lamella CutPiece against its OWN profile's maxLamellaSpanMm
 * (not the pattern-wide minimum used to place purlins — a specific piece is
 * only ever built from one profile, and that profile's own limit is what
 * matters for whether THAT piece sags).
 *
 * Deliberately independent of *why* a piece might be too long — whether
 * purlinProfileId was left unset (spec.purlinProfileId === undefined, the
 * "NO_PURLIN" UI default), the chosen purlin has interruptsLamella: false, or
 * maxLamellaSpanMm just doesn't divide the span cleanly — any of these show
 * up here identically, as a piece whose lengthAxisMm exceeds its own
 * profile's limit. Callers (e.g. the CRM debug page) should treat a non-empty
 * result as a hard error, not a warning: the caller is responsible for
 * refusing to render/quote and surfacing `message` to the user.
 */
export function validateLamellaSpans(
  lamellaPieces: CutPiece[],
  profiles: Map<string, ProfileDimensions>,
): StructuralIssue[] {
  const issues: StructuralIssue[] = []

  for (const piece of lamellaPieces) {
    if (piece.role !== 'lamella') continue
    const profile = profiles.get(piece.profileId)
    const maxSpanMm = profile?.maxLamellaSpanMm
    if (maxSpanMm == null || !(maxSpanMm > 0)) continue

    if (piece.lengthAxisMm > maxSpanMm + SPAN_EPSILON_MM) {
      issues.push({
        code: 'lamella-span-exceeds-max',
        message:
          `Lamella "${piece.id}" (profile "${piece.profileId}") runs unsupported for ` +
          `${Math.round(piece.lengthAxisMm)}mm, exceeding this profile's maxLamellaSpanMm ` +
          `(${maxSpanMm}mm). Choose a purlin profile with interruptsLamella: true and a ` +
          `high-enough purlin count, or a lamella profile rated for this span.`,
        pieceId: piece.id,
        profileId: piece.profileId,
        spanMm: piece.lengthAxisMm,
        maxSpanMm,
      })
    }
  }

  return issues
}
