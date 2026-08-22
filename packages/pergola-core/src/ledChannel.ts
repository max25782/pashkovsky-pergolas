import type { CutPiece, ProfileDimensions } from './types'

/**
 * Total LED strip length needed for one pergola, mm.
 *
 * Rule (see prompt "подсветка встроена в профиль прогона"): a purlin profile
 * with `hasLedChannel: true` carries a built-in LED channel along its full
 * length — the strip runs exactly where the purlin runs, nowhere else. The
 * required strip length is therefore simply the sum of the (long-point)
 * lengths of every `purlin` CutPiece cut from such a profile — no separate
 * "lighting layout" step, because the geometry is already fully determined
 * by computePurlins.
 *
 * Uses lengthLongMm (not lengthAxisMm): the strip has to physically reach
 * the long point of a mitered purlin end to stay flush with the profile,
 * same reasoning as ordering bar stock by lengthLongMm in stockLength.ts.
 *
 * Pieces whose profile is missing from `profiles`, or whose profile has
 * `hasLedChannel` unset/false, or whose role isn't 'purlin', don't
 * contribute. Returns 0 for an empty/all-non-LED piece list — never throws
 * (unlike computeLamellas/computePurlins, this is a read-only aggregation
 * over already-computed pieces, not a placement rule with required inputs).
 */
export function computeLedStripLengthMm(
  pieces: CutPiece[],
  profiles: Map<string, ProfileDimensions>,
): number {
  let total = 0
  for (const piece of pieces) {
    if (piece.role !== 'purlin') continue
    const profile = profiles.get(piece.profileId)
    if (!profile?.hasLedChannel) continue
    total += piece.lengthLongMm
  }
  return total
}

/** Purlin pieces whose profile has an LED channel — what the 3D renderer should draw light strips along (see prompt: "полосы света идут ровно по прогонам"). */
export function ledPurlinPieces(
  pieces: CutPiece[],
  profiles: Map<string, ProfileDimensions>,
): CutPiece[] {
  return pieces.filter((piece) => {
    if (piece.role !== 'purlin') return false
    return profiles.get(piece.profileId)?.hasLedChannel === true
  })
}
