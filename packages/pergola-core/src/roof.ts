import type { Point2D, PergolaSpec, RoofSlope } from './types'
import { isCCW } from './miter'
import { sanitizeContour } from './contourSanitize'

export interface SupportPoint {
  id: string
  plan: Point2D
}

export interface RoofResidual {
  id: string
  residualMm: number
}

export interface RoofPlane {
  /** y = a·x + b·z + c  (plan y stored as world z) */
  a: number
  b: number
  c: number
  /** Unit normal, y-up, pointing generally upward */
  normal: [number, number, number]
  slopeAngleRad: number
  /** Downhill unit in plan (x, z) */
  fallDir: Point2D
  source: 'slope' | 'overrides'
  residualsMm: RoofResidual[]
  maxAbsResidualMm: number
  warning: string | null
}

export const ROOF_PLANE_RESIDUAL_WARN_MM = 5
export const DEFAULT_ROOF_SLOPE: RoofSlope = { mode: 'deg', value: 0 }

const EPS = 1e-9

function hypot2(x: number, y: number): number {
  return Math.sqrt(x * x + y * y)
}

function normalize3(x: number, y: number, z: number): [number, number, number] {
  const L = Math.sqrt(x * x + y * y + z * z)
  return L < EPS ? [0, 1, 0] : [x / L, y / L, z / L]
}

function contourForSlope(spec: PergolaSpec): Point2D[] {
  return sanitizeContour(spec.contour)
}

export function isFlatRoofSpec(spec: Pick<PergolaSpec, 'slope' | 'postHeightOverridesMm'>): boolean {
  const slopeZero = spec.slope == null || spec.slope.value === 0
  const overrides = spec.postHeightOverridesMm
  const hasOverride = overrides != null && Object.keys(overrides).length > 0
  return slopeZero && !hasOverride
}

export function isHorizontalPlane(plane: RoofPlane): boolean {
  return Math.abs(plane.a) < 1e-12 && Math.abs(plane.b) < 1e-12
}

export function horizontalRoofPlane(heightMm: number): RoofPlane {
  return planeFromAbc(0, 0, heightMm, {
    source: 'slope',
    residualsMm: [],
    maxAbsResidualMm: 0,
    warning: null,
    fallDir: [0, 1],
  })
}

export function heightOnPlane(plane: RoofPlane, plan: Point2D): number {
  return plane.a * plan[0] + plane.b * plan[1] + plane.c
}

export function slopedAxisLengthMm(planLengthMm: number, tiltRad: number): number {
  const cos = Math.cos(tiltRad)
  if (Math.abs(cos) < 1e-9) {
    throw new Error('Cannot take sloped length: piece tilt is vertical (cos ≈ 0)')
  }
  return planLengthMm / cos
}

export function pieceTiltRad(plane: RoofPlane, planA: Point2D, planB: Point2D): number {
  const dx = planB[0] - planA[0]
  const dz = planB[1] - planA[1]
  const planLen = hypot2(dx, dz)
  if (planLen < EPS) return 0
  return Math.atan2(heightOnPlane(plane, planB) - heightOnPlane(plane, planA), planLen)
}

function cross3(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
): [number, number, number] {
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx]
}

function rotateAroundAxis(
  vx: number, vy: number, vz: number,
  ax: number, ay: number, az: number,
  ang: number,
): [number, number, number] {
  const c = Math.cos(ang)
  const s = Math.sin(ang)
  const dot = vx * ax + vy * ay + vz * az
  return [
    vx * c + (ay * vz - az * vy) * s + ax * dot * (1 - c),
    vy * c + (az * vx - ax * vz) * s + ay * dot * (1 - c),
    vz * c + (ax * vy - ay * vx) * s + az * dot * (1 - c),
  ]
}

/**
 * Euler XYZ so local +X follows the 3D chord on the plane and local +Y
 * stands on the roof (plane normal). extraTiltAroundX is the lamella
 * open/close angle. On a horizontal plane this is [extra, −azimuth, 0].
 */
export function eulerOnPlane(
  planA: Point2D,
  planB: Point2D,
  plane: RoofPlane,
  extraTiltAroundX = 0,
): [number, number, number] {
  const dx = planB[0] - planA[0]
  const dy = heightOnPlane(plane, planB) - heightOnPlane(plane, planA)
  const dz = planB[1] - planA[1]
  const [Xx, Xy, Xz] = normalize3(dx, dy, dz)
  let [Zx, Zy, Zz] = cross3(Xx, Xy, Xz, plane.normal[0], plane.normal[1], plane.normal[2])
  if (hypot2(hypot2(Zx, Zy), Zz) < EPS) {
    const az = Math.atan2(dz, dx)
    Zx = -Math.sin(az)
    Zy = 0
    Zz = Math.cos(az)
  } else {
    ;[Zx, Zy, Zz] = normalize3(Zx, Zy, Zz)
  }
  let [Yx, Yy, Yz] = cross3(Zx, Zy, Zz, Xx, Xy, Xz)
  ;[Yx, Yy, Yz] = normalize3(Yx, Yy, Yz)
  if (extraTiltAroundX !== 0) {
    ;[Yx, Yy, Yz] = rotateAroundAxis(Yx, Yy, Yz, Xx, Xy, Xz, extraTiltAroundX)
    ;[Zx, Zy, Zz] = rotateAroundAxis(Zx, Zy, Zz, Xx, Xy, Xz, extraTiltAroundX)
  }
  const m13 = Zx
  const ry = Math.asin(Math.max(-1, Math.min(1, m13)))
  if (Math.abs(m13) < 0.9999999) {
    return [Math.atan2(-Zy, Zz), ry, Math.atan2(-Yx, Xx)]
  }
  return [Math.atan2(Yz, Yy), ry, 0]
}

export function offsetAlongNormal(
  position: [number, number, number],
  plane: RoofPlane,
  offsetMm: number,
): [number, number, number] {
  if (offsetMm === 0) return position
  return [
    position[0] + plane.normal[0] * offsetMm,
    position[1] + plane.normal[1] * offsetMm,
    position[2] + plane.normal[2] * offsetMm,
  ]
}

export function placeOnRoof(
  planA: Point2D,
  planB: Point2D,
  plane: RoofPlane,
  extraTiltAroundX = 0,
): { position: [number, number, number]; rotation: [number, number, number]; axisMm: number; tiltRad: number } {
  const planLen = hypot2(planB[0] - planA[0], planB[1] - planA[1])
  const tiltRad = pieceTiltRad(plane, planA, planB)
  return {
    position: [planA[0], heightOnPlane(plane, planA), planA[1]],
    rotation: eulerOnPlane(planA, planB, plane, extraTiltAroundX),
    axisMm: slopedAxisLengthMm(planLen, tiltRad),
    tiltRad,
  }
}

function planeFromAbc(
  a: number,
  b: number,
  c: number,
  extras: Pick<RoofPlane, 'source' | 'residualsMm' | 'maxAbsResidualMm' | 'warning' | 'fallDir'>,
): RoofPlane {
  const normal = normalize3(-a, 1, -b)
  const slopeAngleRad = Math.atan(hypot2(a, b))
  return { a, b, c, normal, slopeAngleRad, ...extras }
}

function centroid(pts: Point2D[]): Point2D {
  let x = 0
  let y = 0
  for (const p of pts) {
    x += p[0]
    y += p[1]
  }
  const n = Math.max(pts.length, 1)
  return [x / n, y / n]
}

function pointsCollinear(pts: Point2D[]): boolean {
  if (pts.length < 3) return true
  const [x0, y0] = pts[0]
  let ux = 0
  let uy = 0
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - x0
    const dy = pts[i][1] - y0
    if (hypot2(dx, dy) < 1e-6) continue
    if (ux === 0 && uy === 0) {
      ux = dx
      uy = dy
      continue
    }
    if (Math.abs(ux * dy - uy * dx) > 1) return false
  }
  return true
}

function solve3(A: number[][], rhs: number[]): [number, number, number] | null {
  const M = A.map((row, i) => [...row, rhs[i]])
  const n = 3
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r
    }
    if (Math.abs(M[pivot][col]) < 1e-12) return null
    if (pivot !== col) {
      const tmp = M[col]
      M[col] = M[pivot]
      M[pivot] = tmp
    }
    const div = M[col][col]
    for (let c = col; c <= n; c++) M[col][c] /= div
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = M[r][col]
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c]
    }
  }
  return [M[0][3], M[1][3], M[2][3]]
}

function fitPlaneLeastSquares(points: Array<{ plan: Point2D; heightMm: number; id: string }>): {
  a: number
  b: number
  c: number
  residuals: RoofResidual[]
} | null {
  if (points.length < 3) return null
  const ATA = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]
  const ATy = [0, 0, 0]
  for (const p of points) {
    const row = [p.plan[0], p.plan[1], 1]
    for (let i = 0; i < 3; i++) {
      ATy[i] += row[i] * p.heightMm
      for (let j = 0; j < 3; j++) ATA[i][j] += row[i] * row[j]
    }
  }
  const sol = solve3(ATA, ATy)
  if (sol == null) return null
  const [a, b, c] = sol
  const residuals = points.map((p) => ({
    id: p.id,
    residualMm: p.heightMm - (a * p.plan[0] + b * p.plan[1] + c),
  }))
  return { a, b, c, residuals }
}

function planeFromSlope(spec: PergolaSpec): RoofPlane {
  const pts = contourForSlope(spec)
  const n = pts.length
  const high = n === 0 ? 0 : ((spec.highEdgeIndex ?? 0) % n + n) % n
  const A = pts[high] ?? ([0, 0] as Point2D)
  const B = pts.length > 0 ? pts[(high + 1) % n] : ([1, 0] as Point2D)
  const ex = B[0] - A[0]
  const ey = B[1] - A[1]
  const eLen = hypot2(ex, ey)
  const edgeDir: Point2D = eLen < EPS ? [1, 0] : [ex / eLen, ey / eLen]
  let inward: Point2D = [-edgeDir[1], edgeDir[0]]
  if (pts.length >= 3) {
    const c = centroid(pts)
    const mid: Point2D = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2]
    if ((c[0] - mid[0]) * inward[0] + (c[1] - mid[1]) * inward[1] < 0) {
      inward = [-inward[0], -inward[1]]
    }
  }
  const slope = spec.slope ?? DEFAULT_ROOF_SLOPE
  let tan = 0
  if (slope.value !== 0) {
    if (slope.mode === 'deg') tan = Math.tan((slope.value * Math.PI) / 180)
    else if (slope.mode === 'percent') tan = slope.value / 100
    else {
      let run = 0
      for (const p of pts) {
        const d = (p[0] - A[0]) * inward[0] + (p[1] - A[1]) * inward[1]
        if (d > run) run = d
      }
      tan = run > EPS ? (slope.value * 10) / run : 0
    }
  }
  const a = -tan * inward[0]
  const b = -tan * inward[1]
  const c = spec.heightMm + tan * (A[0] * inward[0] + A[1] * inward[1])
  return planeFromAbc(a, b, c, {
    source: 'slope',
    residualsMm: [],
    maxAbsResidualMm: 0,
    warning: null,
    fallDir: inward,
  })
}

/**
 * Single roof plane for the spec. 3+ non-collinear post-height overrides
 * replace the slope-based plane (least squares). Otherwise slope + high
 * edge win; individual overrides still apply later at each post.
 */
export function roofPlane(spec: PergolaSpec, supportPoints: SupportPoint[] = []): RoofPlane {
  const overrides = spec.postHeightOverridesMm ?? {}
  const fittedPts = supportPoints
    .filter((p) => Object.prototype.hasOwnProperty.call(overrides, p.id))
    .map((p) => ({ id: p.id, plan: p.plan, heightMm: overrides[p.id] }))

  if (fittedPts.length >= 3 && !pointsCollinear(fittedPts.map((p) => p.plan))) {
    const fit = fitPlaneLeastSquares(fittedPts)
    if (fit != null) {
      const maxAbsResidualMm = fit.residuals.reduce((m, r) => Math.max(m, Math.abs(r.residualMm)), 0)
      const warning =
        maxAbsResidualMm > ROOF_PLANE_RESIDUAL_WARN_MM
          ? `Roof plane residual ${maxAbsResidualMm.toFixed(1)} mm exceeds ${ROOF_PLANE_RESIDUAL_WARN_MM} mm — posts do not lie on one plane.`
          : null
      const fall: Point2D = hypot2(fit.a, fit.b) < EPS ? [0, 1] : normalize2_([-fit.a, -fit.b])
      return planeFromAbc(fit.a, fit.b, fit.c, {
        source: 'overrides',
        residualsMm: fit.residuals,
        maxAbsResidualMm,
        warning,
        fallDir: fall,
      })
    }
  }

  return planeFromSlope(spec)
}

function normalize2_(v: Point2D): Point2D {
  const L = hypot2(v[0], v[1])
  return L < EPS ? [0, 1] : [v[0] / L, v[1] / L]
}

export function postHeightMm(spec: PergolaSpec, plane: RoofPlane, id: string, plan: Point2D): number {
  const overrides = spec.postHeightOverridesMm
  if (overrides != null && Object.prototype.hasOwnProperty.call(overrides, id)) {
    return overrides[id]
  }
  return heightOnPlane(plane, plan)
}

/** Keep a winding helper available for callers that share frame's contour. */
export function specContourCCW(spec: PergolaSpec): Point2D[] {
  const clean = sanitizeContour(spec.contour)
  return isCCW(clean) ? clean : [...clean].reverse()
}
