/** All linear dimensions in millimetres. All angles in degrees, unless noted. */

export type Point2D  = [number, number]
export type Vector2D = [number, number]
export type PieceRole = 'post' | 'beam' | 'lamella' | 'hanger'

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
  /** Clear gap between adjacent lamella centre lines, mm */
  lamellaGapMm: number
  /** Tilt of each lamella from horizontal (0 = flat/closed, 90 = vertical/open) */
  lamellaAngleDeg: number
  /** Direction the lamellas run, degrees from positive X axis (0 = left→right) */
  lamellaDirectionDeg: number
  postProfileId: string
  beamProfileId: string
  lamellaProfileId: string
  color: string

  /**
   * How the pergola is supported.
   * @default 'posts'
   */
  supportType?: SupportType

  /** Index of the contour edge against the wall (edge vertex i → vertex i+1). */
  wallEdgeIndex?: number

  /**
   * Profile ID for the wall-mounting channel (used on the wall edge when
   * supportType === 'wall-mounted').  Falls back to beamProfileId if omitted.
   */
  wallProfileId?: string

  /** @deprecated Use supportType: 'wall-mounted' instead */
  attachedToWall?: boolean
}

/** Physical cross-section of an aluminium extrusion profile */
export interface ProfileDimensions {
  widthMm: number
  heightMm: number
  /**
   * Maximum recommended unsupported span for this profile, mm.
   * Used by computeFrame to insert intermediate posts.
   * Only relevant for beam profiles; omit for post / lamella profiles.
   */
  maxSpanMm?: number
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
