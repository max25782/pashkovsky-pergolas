import type { CutPiece, Point2D } from '@pashkovsky/pergola-core'
import { pieceAxis } from '@pashkovsky/pergola-core'

/** How close two beam pieces' endpoints must sit to count as the same joint, mm. */
const JOINT_EPS_MM = 1
/** Max drift in a (unit) direction vector's component to still count as "the same line", dimensionless. */
const DIR_EPS = 1e-3

function sub(a: Point2D, b: Point2D): Point2D {
  return [a[0] - b[0], a[1] - b[1]]
}
function len(a: Point2D): number {
  return Math.hypot(a[0], a[1])
}

/**
 * One geometric side of the pergola's polygon — the straight run a single
 * axial dimension chain measures along — plus a stable id for it.
 */
export interface GeometricSide {
  id: string
  start: Point2D
  end: Point2D
}

/**
 * Reconstructs one `GeometricSide` per ORIGINAL polygon edge from
 * `pieces.filter(p => p.role === 'beam')`, regardless of how many stock
 * pieces that edge was cut into — see prompt "по сторонам исходного
 * полигона (рёбрам контура), не по сегментированным балкам и не по
 * frame.beams напрямую — по геометрическим сторонам".
 *
 * Deliberately does NOT introduce a second contour source (no separate
 * `PergolaSpec.contour` prop threaded through the drawing layer — see this
 * package's own long-standing rule "два независимых источника контура
 * разошлись бы", TopPlanSheet.tsx). Instead it re-derives the ORIGINAL
 * edges purely from adjacency + collinearity of consecutive beam pieces:
 * `segmentBeamsForStock` always emits every segment of one edge
 * consecutively and exactly collinearly (see beamSegmentation.ts), so a
 * run of pieces whose endpoints touch (within `JOINT_EPS_MM`) and whose
 * direction vector doesn't change (within `DIR_EPS`) is, geometrically,
 * one straight polygon side — an ordinary splice along it is NOT a corner
 * and must NOT start a new side, while an actual corner (direction
 * changes) always does. No dependency on `-segN` id suffixes or any other
 * naming convention, so this stays correct for any future segmentation
 * strategy that preserves "consecutive + collinear ⇒ same original edge".
 *
 * @param beams Perimeter beam pieces in polygon order, exactly as they
 *              come out of the pieces pipeline (segmented or not — either
 *              works, since an unsegmented input is just "every run has
 *              length 1").
 */
export function groupBeamsIntoGeometricSides(beams: CutPiece[]): GeometricSide[] {
  const sides: GeometricSide[] = []

  let runId = ''
  let runStart: Point2D | null = null
  let runEnd: Point2D | null = null
  let runDir: Point2D | null = null

  function flush() {
    if (runStart != null && runEnd != null) sides.push({ id: runId, start: runStart, end: runEnd })
    runStart = null
    runEnd = null
    runDir = null
  }

  for (const beam of beams) {
    const { start, end } = pieceAxis(beam)
    const segLenMm = len(sub(end, start))
    const dir: Point2D = segLenMm > 1e-6 ? [(end[0] - start[0]) / segLenMm, (end[1] - start[1]) / segLenMm] : [1, 0]

    const continuesRun =
      runEnd != null &&
      runDir != null &&
      len(sub(start, runEnd)) <= JOINT_EPS_MM &&
      Math.abs(dir[0] - runDir[0]) <= DIR_EPS &&
      Math.abs(dir[1] - runDir[1]) <= DIR_EPS

    if (continuesRun) {
      runEnd = end
    } else {
      flush()
      runId = beam.id
      runStart = start
      runEnd = end
      runDir = dir
    }
  }
  flush()

  return sides
}
