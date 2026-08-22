/** All linear dimensions in millimetres. All angles in degrees, unless noted. */

import type { VisturTolerances } from './visturTolerances'

export type Point2D  = [number, number]
export type Vector2D = [number, number]
export type PieceRole = 'post' | 'beam' | 'lamella' | 'hanger' | 'purlin'

/**
 * A single manufactured piece ready for cutting.
 *
 * Three lengths (all in mm):
 *   lengthAxisMm  — centerline to centerline (what scan-line clipping computes)
 *   lengthLongMm  — long-point to long-point; the bar must be AT LEAST this long
 *   lengthShortMm — short-point to short-point; used for cutting verification
 *
 *   lengthLong  = lengthAxis + Δ_start + Δ_end
 *   lengthShort = lengthAxis − Δ_start − Δ_end
 *   Δ_i = tan(cutMiterDeg_i) × profile.widthMm/2
 *        + tan(cutBevelDeg_i)/cos(cutMiterDeg_i) × profile.heightMm/2
 *
 * Two saw settings per end (always ≥ 0°):
 *   cutMiterDeg — saw TABLE rotation (degrees from straight cross-cut)
 *                 For horizontal pieces with a plan-view miter: equals the plan angle.
 *                 For tilted pieces: compound-angle corrected value.
 *   cutBevelDeg — saw BLADE tilt from vertical
 *                 0° for horizontal pieces (beams, flat lamellae).
 *                 Nonzero when the piece is tilted (lamellaAngleDeg ≠ 0).
 *
 * Formula derivation (miter saw local coords: X=length, Y=width, Z=height):
 *   Cut-plane normal projected into piece coords:
 *     N = (cos β · s_m,  c,  −sin β · s_m)
 *   where β = lamellaAngleDeg, c = dot(lamellaDir, edgeDir), s_m = cross(edgeDir, lamellaDir)
 *
 *   cutMiterDeg = atan(tan(α_m) / cos β)   [α_m = plan cut angle = asin(|c|)]
 *   cutBevelDeg = asin(sin β · |s_m|)       [|s_m| = cos(α_m)]
 *
 * cutHand: bevel direction looking from piece START toward END,
 *          decorative face up.
 *   'L'        → long point to the LEFT  (interior of polygon to the left)
 *   'R'        → long point to the RIGHT
 *   'straight' → both miter and bevel are 0°
 */
export interface CutPiece {
  id: string
  role: PieceRole
  profileId: string

  /** Centerline-to-centerline length, mm */
  lengthAxisMm: number
  /**
   * Long-point to long-point, mm.
   * The raw bar must be at least this long.
   * = lengthAxisMm + Δ_start + Δ_end
   */
  lengthLongMm: number
  /**
   * Short-point to short-point, mm.
   * = lengthAxisMm − Δ_start − Δ_end
   */
  lengthShortMm: number

  /** Saw table rotation at START end, degrees ≥ 0 (0 = straight cross-cut) */
  cutMiterStartDeg: number
  /** Saw blade tilt at START end, degrees ≥ 0 (0 = vertical blade) */
  cutBevelStartDeg: number
  /** Bevel direction at start end */
  cutHandStart: 'L' | 'R' | 'straight'

  /** Saw table rotation at END end, degrees ≥ 0 */
  cutMiterEndDeg: number
  /** Saw blade tilt at END end, degrees ≥ 0 */
  cutBevelEndDeg: number
  /** Bevel direction at end */
  cutHandEnd: 'L' | 'R' | 'straight'

  /** World-space position [x, y, z], mm — consumed by 3D renderer */
  position: [number, number, number]
  /** Euler rotation [rx, ry, rz], radians — consumed by 3D renderer */
  rotation: [number, number, number]
  /** RAL hex colour string */
  color: string
}

/**
 * How the pergola is supported.
 *   'posts'        — freestanding on vertical posts (default)
 *   'wall-mounted' — one edge attaches to a wall (posts only on free sides)
 *                    Requires wallEdgeIndex.  The wall edge uses wallProfileId
 *                    (a mounting channel) instead of beamProfileId.
 *   'hanging'      — suspended from ceiling/wall, no posts at all
 */
export type SupportType = 'posts' | 'wall-mounted' | 'hanging'

/**
 * Full specification for one pergola.
 * Contour: arbitrary closed polygon, CCW winding preferred (auto-normalised by build()).
 * Min 3 vertices, no repeated first/last vertex, no self-intersections.
 */
export interface PergolaSpec {
  contour: Array<Point2D>
  heightMm: number
  /**
   * Clear gap between adjacent lamella edges, mm (NOT the pitch — see
   * computeLamellas: pitch = lamellaProfile.widthMm + lamellaGapMm). The
   * field name is unchanged (no persisted spec used the old "pitch" meaning
   * — confirmed by a repo-wide search before the change) but the meaning was
   * fixed after the "roof renders as a solid slab" bug: the old code used
   * this value directly as the scan pitch, ignoring the profile width
   * entirely, so any profile wider than the configured value produced
   * heavily overlapping pieces.
   */
  lamellaGapMm: number
  /** Tilt of each lamella from horizontal (0 = flat/closed, 90 = vertical/open) */
  lamellaAngleDeg: number
  /** Direction the lamellas run, degrees from positive X axis (0 = left→right) */
  lamellaDirectionDeg: number
  /**
   * Mounting orientation of the lamella cross-section, NOT a render-only
   * flag — it changes computeLamellas' pitch and therefore the piece count
   * and cut list (see computeLamellas' "VISIBLE WIDTH" comment):
   *   false (default) — flat: profile.widthMm lies horizontal (the visible
   *     face, seen from above/below); profile.heightMm is the (vertical)
   *     thickness. Visible width = profile.widthMm.
   *   true             — on edge: cross-section rotated 90° about the
   *     lamella's own length axis; profile.heightMm becomes the visible
   *     (horizontal) width, profile.widthMm becomes vertical.
   * Any change ⇒ full recompute (new pitch ⇒ different piece count).
   */
  lamellaOnEdge?: boolean
  postProfileId: string
  beamProfileId: string
  lamellaProfileId: string
  /**
   * Repeating sequence of lamella profile IDs for a mixed-width layout (see
   * prompt "смешанные ламели — чередование разных ширин"), e.g.
   * ['f7020', 'f4020', 'f2020'] lays 70/40/20mm lamellas in that order,
   * cycling back to the start when the span isn't used up. The pitch
   * between two adjacent rows is NOT constant — it depends on BOTH
   * profiles' visible widths:
   *   spacing(i→i+1) = visibleWidth(i)/2 + lamellaGapMm + visibleWidth(i+1)/2
   * (see computeLamellas / resolveLamellaPattern in lamellaPattern.ts).
   *
   * undefined or [] ⇒ homogeneous layout, equivalent to [lamellaProfileId]
   * — the homogeneous case is a pattern of length 1, not a separate code
   * path (computeLamellas/computePurlins always go through
   * resolveLamellaPattern). Any change here ⇒ full recompute, same as
   * lamellaProfileId/lamellaGapMm/lamellaOnEdge.
   */
  lamellaPattern?: string[]
  color: string

  /**
   * Purlin (intermediate rafter) profile ID — optional. Its
   * ProfileDimensions.interruptsLamella/hasLedChannel decide whether
   * computeLamellas segments lamellas at purlin crossings and whether an LED
   * channel length is implied. undefined ⇒ no purlins are computed at all
   * (computePurlins returns []), regardless of lamellaProfile.maxLamellaSpanMm.
   */
  purlinProfileId?: string

  /**
   * Profile ID for the non-LED divider beam Rule B introduces (see
   * segmentLedPurlinsForStock in ledPurlinReversal.ts) when an LED purlin's
   * own span is longer than any available stock length — LED profiles
   * can't be spliced, so the span is instead cut into sections by a plain
   * crossing beam, and dense short LED purlins run within each section.
   * Falls back to beamProfileId when unset (same aluminium beam family,
   * just positioned internally instead of on the perimeter) — confirm with
   * the real catalog if a dedicated profile should be used instead.
   */
  ledDividerProfileId?: string

  /**
   * How the pergola is supported.
   * @default 'posts'
   */
  supportType?: SupportType

  /**
   * Indices of contour edges attached to a wall (edge vertex i → vertex
   * i+1), normalised mod contour length by computeFrame. Generalises the
   * single-wall-edge model to any number of wall sides (e.g. an L-shaped
   * pergola built into a building corner, with two wall edges). A vertex is
   * skipped for a corner post iff it is an endpoint of AT LEAST ONE of these
   * edges — see computeFrame.
   */
  wallEdgeIndices?: number[]

  /**
   * Profile ID for the wall-mounting channel (used on all wall edges when
   * supportType === 'wall-mounted'). Falls back to beamProfileId if omitted.
   */
  wallProfileId?: string

  /** @deprecated Use supportType: 'wall-mounted' instead */
  attachedToWall?: boolean

  /**
   * Opts this pergola into "вистур" factory-welded-frame assembly clearances
   * (see visturTolerances.ts — TWO independent clearances, one per frame
   * axis, on two DIFFERENT pieces) — undefined (default) ⇒ standard
   * on-site assembly, every length below is exactly the raw span with no
   * clearance subtracted (pre-existing behaviour, unchanged). Set ⇒
   *   • computeFrame splits each perimeter beam into one welded segment
   *     per bay (between adjacent posts) and retracts EACH segment's BOTH
   *     ends by beamSegmentReductionMm/2 mm (every segment boundary on
   *     this axis is a post).
   *   • computeLamellas retracts each lamella's END(S) that meet the
   *     frame's OWN outer perimeter beam by lamellaLengthReductionMm/2 mm
   *     (internal purlin-crossing straight cuts are untouched — see
   *     computeLamellas VISTUR ASSEMBLY CLEARANCE comment).
   */
  visturTolerances?: VisturTolerances
}

/**
 * Physical cross-section of an aluminium extrusion profile.
 *
 * ORIENTATION IS EXPLICIT AND FIXED BY THESE FIELD NAMES — do NOT infer it
 * from the profile's supplier name/id (e.g. "f10040" is ambiguous: it could
 * be read as "100×40" OR "40×100"). widthMm/heightMm always mean:
 *
 *   widthMm  — the HORIZONTAL, in-plan dimension: perpendicular to the
 *              piece's length axis, lying flat in the horizontal plane.
 *              For beams/purlins this is the dimension that participates in
 *              the contour offset and miter length math (frame.ts
 *              miterOffset, lamellas.ts longPointOffset) — it is NEVER
 *              heightMm, regardless of which number is larger.
 *   heightMm — the VERTICAL dimension: how tall the cross-section stands.
 *
 * Example: a beam sold as "100×40" that must be installed standing on its
 * narrow edge (40mm resting on the post, 100mm rising vertically) is
 * entered as { widthMm: 40, heightMm: 100 } — NOT { widthMm: 100,
 * heightMm: 40 }, even though the supplier writes "100" first. Getting this
 * backwards is exactly the "beam lying on its side" class of bug (see
 * pergola-3d-preview/geometryBuilder.ts axis-orientation fix) — the catalog
 * entry, not just the renderer, must encode the real mounting orientation.
 *
 * Lamellas are the one exception with a runtime override: PergolaSpec.
 * lamellaOnEdge swaps which of widthMm/heightMm is horizontal at compute
 * time (see computeLamellas) — the catalog value itself still always means
 * "flat/default" orientation as defined above.
 */
export interface ProfileDimensions {
  widthMm: number
  heightMm: number
  /**
   * Maximum recommended unsupported span for this profile, mm.
   * Used by computeFrame to insert intermediate posts.
   * Only relevant for beam profiles; omit for post / lamella profiles.
   */
  maxSpanMm?: number

  /**
   * Maximum unsupported span of a LAMELLA cut from this profile, mm.
   * Used by computePurlins/computeLamellas to insert intermediate purlins.
   * Property of the LAMELLA profile (thinner slats sag over a shorter span
   * than thicker ones) — only relevant for lamella profiles, omit otherwise.
   * No default: undefined ⇒ no purlins are ever inserted (back-compat with
   * specs that don't set purlinProfileId).
   */
  maxLamellaSpanMm?: number

  /**
   * true ⇒ a purlin cut from this profile physically interrupts the lamella
   * run: the lamella is cut into one segment per span, with a straight end
   * at every purlin crossing (see computeLamellas). false/undefined ⇒ the
   * purlin sits above the lamella plane and the lamella stays one continuous
   * piece from perimeter beam to perimeter beam. Only relevant for purlin
   * profiles (spec.purlinProfileId).
   */
  interruptsLamella?: boolean

  /**
   * true ⇒ this purlin profile has a built-in LED channel. Drives automatic
   * LED strip length (sum of all purlin lengths) and, in 3D, light strips
   * placed exactly on purlin geometry (not scattered around the perimeter).
   * Only relevant for purlin profiles.
   */
  hasLedChannel?: boolean

  /**
   * Maximum spacing between adjacent LED purlins along the lamella
   * direction, mm — a LIGHTING density requirement, independent of the
   * structural maxLamellaSpanMm (see prompt "макс_шаг_LED... параметр,
   * в каталог/конфиг, не константа"). Only consulted when an LED purlin's
   * own span (perpendicular to the lamellas) is longer than every
   * availableStockLengthsMm option, forcing Rule B's 90° reversal —
   * segmentLedPurlinsForStock then places one short LED purlin every
   * maxLedStepMm (not every maxLamellaSpanMm) within each stock-length
   * section, since a denser lighting grid may be needed than the purely
   * structural purlin grid would otherwise place. Only relevant for LED
   * purlin profiles (hasLedChannel: true); omit otherwise — undefined ⇒
   * falls back to maxLamellaSpanMm's own grid (no extra density).
   */
  maxLedStepMm?: number

  /**
   * Stock bar lengths this profile is actually sold in by the supplier, mm,
   * e.g. [6000, 7000]. Used by the cut-list optimiser (see stockLength.ts)
   * to compare bars-needed/waste across purchasing options and to split a
   * continuous run longer than any single stock length into full-bar pieces.
   * Real values come from the supplier per profile — never invent them.
   */
  availableStockLengthsMm?: number[]

  /**
   * Linear (running) weight of this profile, kg per metre. Used by the CRM
   * order sheet (see apps/crm/lib/cut-list/order-sheet.ts) to total the
   * weight of material to order per profile+color bundle. undefined ⇒ the
   * weight column is left blank ("—"), NOT computed from a guessed density
   * — real values come from the supplier catalog per profile, same rule as
   * availableStockLengthsMm, never invent them.
   */
  weightKgPerMeter?: number
}

/** Miter data computed at one polygon vertex */
export interface MiterAtVertex {
  /** Interior angle of the polygon at this vertex, degrees ∈ (0°, 360°) */
  interiorAngleDeg: number
  /**
   * Signed plan cut angle from perpendicular, degrees.
   * = (180° − interiorAngle) / 2
   * Positive  → convex vertex (interior < 180°, exterior corner)
   * Zero      → straight (collinear vertex)
   * Negative  → reflex vertex (interior > 180°, concave polygon)
   *
   * KERNEL INTERMEDIATE VALUE — do not use directly on cut sheets.
   * For CutPiece use abs(miterAngleDeg); the sign is captured by cutHand*.
   * For horizontal perimeter beams: cutMiterDeg = abs(miterAngleDeg), cutBevelDeg = 0.
   */
  miterAngleDeg: number
  /** True when interior angle < 180° (outside corner) */
  isConvex: boolean
  /** Bevel hand for the beam arriving at this vertex */
  cutHandIncoming: 'L' | 'R' | 'straight'
  /** Bevel hand for the beam leaving this vertex */
  cutHandOutgoing: 'L' | 'R' | 'straight'
}

export type ContourMiters = MiterAtVertex[]
