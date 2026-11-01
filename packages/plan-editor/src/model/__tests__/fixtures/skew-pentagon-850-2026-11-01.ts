/**
 * Skew pentagon from the hand drawing of 2026-11-01 (outer contour only; the
 * drawing's crossbeams are not reproduced). Drawing units are cm; the editor
 * and plan model store mm.
 *
 * Entered size = outer edge. The stored polygon is the beam centerline, the
 * outer contour moved inward by half the beam plan width (f10040 -> 40 mm,
 * 20 mm per side). Mirrored left-right like the outer contour below.
 */

export const SKEW_PENTAGON_850_ID = 'skew-pentagon-850-2026-11-01'

/**
 * Outer contour A..E, cm, MIRRORED left-right relative to the drawing (x' = 629.28 - x):
 * the long side EA is on the right and the contour extends to the left. The editor
 * canvas has Y pointing up, so AB (the 90 side) is at the bottom. Mirroring keeps all
 * sides, angles and the area; it only flips the handedness (the contour now runs
 * clockwise in editor coordinates).
 */
export const SKEW_PENTAGON_850_OUTER_CM: ReadonlyArray<readonly [number, number]> = [
  [629.28, 0],
  [539.28, 0],
  [39.66, 687.66],
  [0, 914.22],
  [629.28, 980.9],
]

/** AB, BC, CD, DE, EA on the drawing, cm. */
export const SKEW_PENTAGON_850_SIDES_CM = [90, 850, 230, 632.8, 980.9]

/** Interior angles A..E on the drawing, degrees (check values). */
export const SKEW_PENTAGON_850_ANGLES_DEG = [90, 126, 153.9, 86.1, 84.0]

/** Outer contour area, m2. */
export const SKEW_PENTAGON_850_OUTER_AREA_M2 = 39.27

/** Outer sizes as typed in the editor, mm (whole mm, as the plan model stores them). */
export const SKEW_PENTAGON_850_TYPED_OUTER_MM = [900, 8500, 2300, 6328, 9809]

/** Beam plan width the centerline below was built for (f10040), mm. */
export const SKEW_PENTAGON_850_BEAM_PLAN_WIDTH_MM = 40

/** Tolerance on sides, cm (0.05 cm = 0.5 mm). */
export const SKEW_PENTAGON_850_SIDE_TOLERANCE_CM = 0.05

/**
 * Frozen centerline polygon, mm: the drawing's outer contour offset inward by
 * 20 mm at every side (mitred corners), rounded to 0.001 mm. This is what a
 * saved plan would hold in `polygon`.
 */
export const SKEW_PENTAGON_850_CENTERLINE_MM: ReadonlyArray<{ x: number; y: number }> = [
  { x: 6269.409, y: 20 },
  { x: 5399.599, y: 20 },
  { x: 412.111, y: 6884.61 },
  { x: 20, y: 9124.567 },
  { x: 6269.409, y: 9786.769 },
]
