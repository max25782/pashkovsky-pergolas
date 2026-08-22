import type { PergolaSpec, ProfileDimensions } from './types'

/**
 * Shared pattern-resolution helper — used by BOTH computeLamellas (placing
 * the actual rows) and computePurlins (deciding where purlins go), so the
 * two always agree on which profiles are in play and how far a lamella
 * profile can span unsupported, by construction rather than convention.
 *
 * See prompt "смешанные ламели — чередование разных ширин": a pergola can
 * lay lamellas in a repeating sequence of DIFFERENT profiles (e.g. 70mm,
 * 40mm, 20mm, repeat) instead of one uniform width. The homogeneous case is
 * NOT a special branch — it is a pattern of length 1, resolved through this
 * exact same function, so there is only one code path for both.
 */

export interface LamellaPatternEntry {
  profileId: string
  profile: ProfileDimensions
  /**
   * The horizontal, pitch-driving dimension of this row's profile, taking
   * spec.lamellaOnEdge into account (see types.ts PergolaSpec.lamellaOnEdge
   * and ProfileDimensions widthMm/heightMm doc) — profile.heightMm when on
   * edge, profile.widthMm when flat (default).
   */
  visibleWidthMm: number
  /**
   * The VERTICAL (thickness) dimension of this row's profile, i.e. whichever
   * of widthMm/heightMm is NOT visibleWidthMm above — profile.widthMm when on
   * edge, profile.heightMm when flat (default). Used by computePurlins to
   * seat a non-interrupting purlin flush on TOP of the lamella (see purlins.ts
   * "vertical seating rule") rather than at the same base height.
   */
  verticalThicknessMm: number
}

/**
 * Resolve spec.lamellaPattern (or, if unset/empty, the single
 * spec.lamellaProfileId as a pattern of length 1) into concrete profiles.
 * Throws if any referenced profile id is missing from `profiles` — same
 * fail-fast contract computeLamellas/computeFrame already use for their own
 * required profile ids.
 */
export function resolveLamellaPattern(
  spec: Pick<PergolaSpec, 'lamellaProfileId' | 'lamellaPattern' | 'lamellaOnEdge'>,
  profiles: Map<string, ProfileDimensions>,
): LamellaPatternEntry[] {
  const ids = spec.lamellaPattern && spec.lamellaPattern.length > 0
    ? spec.lamellaPattern
    : [spec.lamellaProfileId]

  return ids.map((profileId) => {
    const profile = profiles.get(profileId)
    if (!profile) {
      throw new Error(`Profile "${profileId}" not found in profiles map`)
    }
    const visibleWidthMm = spec.lamellaOnEdge ? profile.heightMm : profile.widthMm
    const verticalThicknessMm = spec.lamellaOnEdge ? profile.widthMm : profile.heightMm
    return { profileId, profile, visibleWidthMm, verticalThicknessMm }
  })
}

/**
 * Most conservative (smallest) maxLamellaSpanMm across every profile
 * actually used in the pattern — a mix of e.g. a 70mm slat (sags less) and
 * a 20mm slat (sags more over the same span) must be supported at the
 * THINNEST member's limit, not the average or the thickest. undefined if no
 * profile in the pattern defines maxLamellaSpanMm at all (⇒ no purlin-driven
 * segmentation — same "undefined ⇒ no purlins" contract as the single-
 * profile case).
 */
export function patternMaxLamellaSpanMm(pattern: LamellaPatternEntry[]): number | undefined {
  const values = pattern
    .map((entry) => entry.profile.maxLamellaSpanMm)
    .filter((v): v is number => v != null && v > 0)
  return values.length > 0 ? Math.min(...values) : undefined
}

/**
 * Tallest verticalThicknessMm across every profile in the pattern — a
 * non-interrupting purlin (see purlins.ts) must clear ALL lamella rows, so it
 * is seated on top of the THICKEST slat in the mix, not the thinnest (the
 * mirror image of patternMaxLamellaSpanMm picking the smallest span: there
 * "thinnest governs" because it sags most; here "thickest governs" because it
 * sits highest). 0 for an empty pattern (should not happen in practice, since
 * resolveLamellaPattern always returns at least one entry).
 */
export function patternMaxVerticalThicknessMm(pattern: LamellaPatternEntry[]): number {
  return pattern.reduce((max, entry) => Math.max(max, entry.verticalThicknessMm), 0)
}
