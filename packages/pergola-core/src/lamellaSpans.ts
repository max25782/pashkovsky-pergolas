/**
 * Shared pure geometry for purlin placement — used by BOTH computePurlins
 * (the purlin CutPieces themselves) and computeLamellas (segmenting a
 * lamella row at the exact same crossings when the purlin profile has
 * interruptsLamella: true). Kept in its own module so neither file has to
 * import the other and the two stay in lockstep by construction, not by
 * convention: a purlin crossing and a lamella segment boundary are always
 * the same number, computed once.
 */

/**
 * Internal division points (mm, ABSOLUTE coordinate along the lamella
 * direction — same frame as ScanHit.s in lamellas.ts, since anchor is always
 * perpendicular to `dir` there and contributes zero to the dot product) that
 * split [rangeMinMm, rangeMaxMm] into the fewest equal spans no longer than
 * maxSpanMm.
 *
 *   nSpans = ceil(totalLen / maxSpanMm)
 *   purlinsToAdd = nSpans - 1  (= division points returned)
 *
 * Equal spans (not "maxSpanMm-sized spans + remainder") — a 6000mm run with
 * maxSpanMm=1500 gets 3 evenly-spaced purlins at 1500/3000/4500, not one
 * crammed remainder span. Returns [] if the run already fits in one span
 * (nSpans <= 1) or maxSpanMm is not a usable positive number.
 */
export function computeSpanDivisionPointsMm(
  rangeMinMm: number,
  rangeMaxMm: number,
  maxSpanMm: number | undefined,
): number[] {
  if (maxSpanMm == null || !(maxSpanMm > 0)) return []
  const totalLen = rangeMaxMm - rangeMinMm
  if (totalLen <= maxSpanMm) return []

  const nSpans = Math.ceil(totalLen / maxSpanMm)
  const step = totalLen / nSpans
  const points: number[] = []
  for (let k = 1; k < nSpans; k++) points.push(rangeMinMm + k * step)
  return points
}
