import type { CutPiece, ProfileDimensions, Point2D } from '@pashkovsky/pergola-core'

/**
 * One ROW of the lamella scan (see pergola-core lamellas.ts: every lamella
 * piece with the same scan-axis coordinate came from the same scan line —
 * "same row"). A row can hold >1 CutPiece when interruptsLamella segmented
 * it, or when a non-convex contour split it into independent runs.
 */
export interface LamellaRow {
  /** Position along the axis PERPENDICULAR to the lamella run direction, mm — shared by every piece in this row (by construction, see computeLamellas' scanT). */
  scanCoordinateMm: number
  pieces: CutPiece[]
  /** profileId of this row (all pieces in one row share it — a row is one scan line, one pattern entry). */
  profileId: string
}

function dot(a: Point2D, b: Point2D): number {
  return a[0] * b[0] + a[1] * b[1]
}

/**
 * Groups lamella CutPieces into rows and sorts rows across the pergola
 * (ascending scan coordinate) — the order "Вид Б" (раскладка ламелей) draws
 * them in, and the order buildLamellaRhythm below measures pitch/gap in.
 *
 * Direction is taken from the FIRST piece's own rotation.y (every lamella
 * piece in one pergola shares the same azimuth — see computeLamellas:
 * rotation = [effectiveTiltDeg, −θ, 0] for every row) — NOT re-derived from
 * spec (this function only ever reads CutPiece[], see project rule "чертёж
 * не читает редактор плана... только детали из ядра").
 */
export function groupLamellaRows(lamellas: CutPiece[]): LamellaRow[] {
  if (lamellas.length === 0) return []

  const theta = -lamellas[0].rotation[1]
  const perp: Point2D = [-Math.sin(theta), Math.cos(theta)]

  const rows = new Map<string, LamellaRow>()
  for (const piece of lamellas) {
    const point: Point2D = [piece.position[0], piece.position[2]]
    const scanCoordinateMm = dot(point, perp)
    // Round to the nearest 0.01mm — pieces in the same row share an EXACT
    // scanT by construction (see computeLamellas), this only absorbs
    // floating-point noise, not a real tolerance window.
    const key = scanCoordinateMm.toFixed(2)
    const existing = rows.get(key)
    if (existing) {
      existing.pieces.push(piece)
    } else {
      rows.set(key, { scanCoordinateMm, pieces: [piece], profileId: piece.profileId })
    }
  }

  return [...rows.values()].sort((a, b) => a.scanCoordinateMm - b.scanCoordinateMm)
}

/** One row's visible (pitch-driving) width, mm — see PergolaSpec.lamellaOnEdge / ProfileDimensions widthMm/heightMm doc in pergola-core. */
function visibleWidthMm(row: LamellaRow, profiles: Map<string, ProfileDimensions>, lamellaOnEdge: boolean): number {
  const profile = profiles.get(row.profileId)
  if (!profile) return 0
  return lamellaOnEdge ? profile.heightMm : profile.widthMm
}

export interface LamellaRhythmSegment {
  fromScanCoordinateMm: number
  toScanCoordinateMm: number
  /** Axis-to-axis distance between the two rows' scan lines, mm. */
  pitchMm: number
  /** Clear gap between the two rows' visible faces, mm — pitchMm minus half of each row's own visible width. */
  gapMm: number
}

export interface LamellaRhythm {
  rows: LamellaRow[]
  /** One entry per consecutive pair of rows — length === rows.length − 1. */
  segments: LamellaRhythmSegment[]
}

/**
 * Turns a grouped, sorted row list into the actual pitch/gap numbers "Вид Б"
 * (раскладка ламелей) dimensions — see prompt "просвет проставлен размером
 * ... шаг между осями ламелей".
 *
 * `lamellaOnEdge` is passed in explicitly by the caller (the same boolean
 * PergolaSpec/ConstructionParams already carries) rather than re-derived
 * from CutPiece — a single Euler rotation.x cannot distinguish "flat with
 * lamellaAngleDeg=90" from "onEdge with lamellaAngleDeg=0" (both give the
 * same effective tilt, see lamellas.ts effectiveTiltDeg), so there is no
 * way to recover it purely from geometry. This is NOT a second source of
 * truth: it is the exact same flag the core itself used to pick
 * visibleWidthMm when it built these very pieces (see resolveLamellaPattern
 * in pergola-core) — the drawing does not compute anything new with it, it
 * only re-selects the same catalog field the core already picked.
 */
export function buildLamellaRhythm(
  lamellas: CutPiece[],
  profiles: Map<string, ProfileDimensions>,
  lamellaOnEdge: boolean,
): LamellaRhythm {
  const rows = groupLamellaRows(lamellas)
  const segments: LamellaRhythmSegment[] = []

  for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i]
    const b = rows[i + 1]
    const pitchMm = b.scanCoordinateMm - a.scanCoordinateMm
    const widthA = visibleWidthMm(a, profiles, lamellaOnEdge)
    const widthB = visibleWidthMm(b, profiles, lamellaOnEdge)
    segments.push({
      fromScanCoordinateMm: a.scanCoordinateMm,
      toScanCoordinateMm: b.scanCoordinateMm,
      pitchMm,
      gapMm: pitchMm - widthA / 2 - widthB / 2,
    })
  }

  return { rows, segments }
}
