import type { Point2D, Vector2D, CutPiece, PergolaSpec, ProfileDimensions } from './types'
import { isCCW } from './miter'
import { scanLineClip, cutAtEdge, longPointOffset } from './lamellas'
import { computeSpanDivisionPointsMm } from './lamellaSpans'
import { resolveLamellaPattern, patternMaxLamellaSpanMm, patternMaxVerticalThicknessMm } from './lamellaPattern'
import { sanitizeContour } from './contourSanitize'

const RAD = Math.PI / 180
const HALF_PI = Math.PI / 2

function dot2(a: Vector2D, b: Vector2D): number { return a[0] * b[0] + a[1] * b[1] }

/** Segments shorter than this (mm) are discarded as degenerate — same threshold as lamellas.ts. */
const MIN_SEGMENT_MM = 1.0

/**
 * Compute all purlin (intermediate rafter) CutPieces for one pergola.
 *
 * A purlin runs PERPENDICULAR to the lamellas, at evenly-spaced positions
 * along the lamella direction, one crossing line whenever the unsupported
 * span of a lamella would otherwise exceed lamellaProfile.maxLamellaSpanMm
 * (see computeSpanDivisionPointsMm — same helper, and the same crossing
 * points, that computeLamellas uses to segment lamellas when the purlin
 * profile has interruptsLamella: true, so a purlin and a lamella segment
 * boundary always agree).
 *
 * Each crossing line is itself clipped against the (possibly non-convex)
 * contour via scanLineClip — exactly the same machinery computeLamellas uses,
 * with `dir`/`perp` swapped, so a purlin can legitimately come back as
 * several disjoint pieces (e.g. crossing an L-shaped notch) or as nothing at
 * all for a crossing line that misses the polygon.
 *
 * Returns [] when spec.purlinProfileId is unset, or when the lamella
 * profile's maxLamellaSpanMm is unset/non-positive, or when the polygon's
 * extent along the lamella direction already fits in one span — no purlins
 * needed. Does NOT depend on interruptsLamella: that flag only controls
 * whether computeLamellas also segments the lamella at these same crossings;
 * a non-interrupting purlin (mounted above the lamella plane) still exists
 * as a real CutPiece here.
 *
 * Span-limit note (see prompt "смешанные ламели"): when spec.lamellaPattern
 * mixes several lamella profiles, the span used against maxLamellaSpanMm is
 * patternMaxLamellaSpanMm — the SMALLEST value among all profiles in the
 * pattern (thinnest slat governs) — resolved through the exact same
 * resolveLamellaPattern call computeLamellas uses, so the two always agree
 * on the same crossing points.
 *
 * VERTICAL SEATING RULE (position[1], mm above ground):
 *   Both perimeter beams and lamellas sit on the same "based" baseline —
 *   position.y = spec.heightMm is their BOTTOM face (see geometryBuilder.ts
 *   zMode: 'based' for every non-post role), so a lamella's bottom is already
 *   flush with a beam's bottom at heightMm with NO offset needed here.
 *     • interruptsLamella === true  → the purlin REPLACES the lamella at
 *       that crossing (see computeLamellas SEGMENTATION), so it occupies the
 *       exact same vertical band: position.y = heightMm, same as the
 *       lamella/beam bottom. It simply rises higher (purlinProfile.heightMm,
 *       typically taller than a lamella) while staying inside the beam's own
 *       height envelope.
 *     • interruptsLamella === false (or unset) → the purlin is mounted ABOVE
 *       the lamella plane and must NOT touch it (computeLamellas keeps the
 *       lamella continuous through this crossing): position.y = heightMm +
 *       patternMaxVerticalThicknessMm(pattern) — the lamella's own top face.
 *       The TALLEST lamella profile in a mixed pattern governs (it must
 *       clear every row it crosses, not just the thinnest one).
 *
 * @param spec      PergolaSpec; contour auto-normalised to CCW winding.
 * @param profiles  Map from profileId → ProfileDimensions.
 *                  Must contain every profile id in spec.lamellaPattern (or
 *                  spec.lamellaProfileId when unset) and purlinProfileId (if set).
 */
export function computePurlins(
  spec: PergolaSpec,
  profiles: Map<string, ProfileDimensions>,
): CutPiece[] {
  const { contour, lamellaDirectionDeg, heightMm, color, purlinProfileId } = spec

  if (!purlinProfileId) return []

  const pattern = resolveLamellaPattern(spec, profiles)
  const maxLamellaSpanMm = patternMaxLamellaSpanMm(pattern)
  const purlinProfile = profiles.get(purlinProfileId)
  if (!purlinProfile) {
    throw new Error(`Profile "${purlinProfileId}" not found in profiles map`)
  }

  // See VERTICAL SEATING RULE above.
  const baseYmm = purlinProfile.interruptsLamella === true
    ? heightMm
    : heightMm + patternMaxVerticalThicknessMm(pattern)

  // Same entry-point sanitisation as computeFrame/computeLamellas (see
  // contourSanitize.ts) — computePurlins is called independently of both.
  const cleanContour = sanitizeContour(contour)
  const pts: Point2D[] = isCCW(cleanContour) ? cleanContour : [...cleanContour].reverse()

  const θ = lamellaDirectionDeg * RAD
  // Purlin length axis runs along `perp` (⊥ to the lamellas); its own scan
  // coordinate — the one held fixed per crossing line — is `dir`.
  const dir: Vector2D  = [Math.cos(θ), Math.sin(θ)]
  const perp: Vector2D = [-Math.sin(θ), Math.cos(θ)]

  const dirProjections = pts.map(p => dot2(p, dir))
  const dirMin = Math.min(...dirProjections)
  const dirMax = Math.max(...dirProjections)

  const divisionPointsMm = computeSpanDivisionPointsMm(dirMin, dirMax, maxLamellaSpanMm)

  const pieces: CutPiece[] = []
  let id = 0

  for (const t of divisionPointsMm) {
    const anchor: Point2D = [dir[0] * t, dir[1] * t]
    const hits = scanLineClip(perp, dir, t, anchor, pts)

    for (let k = 0; k + 1 < hits.length; k += 2) {
      const h0 = hits[k]
      const h1 = hits[k + 1]
      const lengthAxisMm = h1.s - h0.s
      if (lengthAxisMm < MIN_SEGMENT_MM) continue

      const startPt: Point2D = [
        anchor[0] + h0.s * perp[0],
        anchor[1] + h0.s * perp[1],
      ]

      const { cutMiterDeg: cms, cutHand: chs } = cutAtEdge(perp, pts, h0.edgeIndex)
      const { cutMiterDeg: cme, cutHand: che } = cutAtEdge(perp, pts, h1.edgeIndex)

      const δStart = longPointOffset(cms, purlinProfile.widthMm)
      const δEnd   = longPointOffset(cme, purlinProfile.widthMm)

      pieces.push({
        id:       `purlin-${id++}`,
        role:     'purlin',
        profileId: purlinProfileId,

        lengthAxisMm,
        lengthLongMm:  lengthAxisMm + δStart + δEnd,
        lengthShortMm: lengthAxisMm - δStart - δEnd,

        cutMiterStartDeg: cms,
        cutBevelStartDeg: 0,
        cutHandStart:     chs,

        cutMiterEndDeg: cme,
        cutBevelEndDeg: 0,
        cutHandEnd:     che,

        // plan (x, y) → world (x, baseYmm, y); Y is up in Three.js. baseYmm
        // is heightMm (flush with lamella/beam bottom) when this purlin
        // interrupts the lamella, or the lamella's own top face when it
        // doesn't — see VERTICAL SEATING RULE above.
        position: [startPt[0], baseYmm, startPt[1]],
        // Purlin's own length axis points along `perp`, i.e. at angle θ+90°
        // from +X — rotation[1] follows the same −angle convention as beams.
        rotation: [0, -(θ + HALF_PI), 0],
        color,
      })
    }
  }

  return pieces
}
