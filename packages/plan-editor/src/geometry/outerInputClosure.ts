import type { FixedEdge } from './types'
import { closureGap } from './closure'

/** Kinematic closure gap from edge lengths and angles (mm). */
export function kinematicClosureGapMm(
  edges: FixedEdge[],
  lengthMm: (edge: FixedEdge, index: number) => number,
): number {
  let x = 0
  let y = 0
  for (let i = 0; i < edges.length; i++) {
    const L = lengthMm(edges[i], i)
    const rad = (edges[i].angleDeg * Math.PI) / 180
    x += L * Math.cos(rad)
    y += L * Math.sin(rad)
  }
  return Math.hypot(x, y)
}

const INPUT_CLOSURE_TOLERANCE_MM = 1

/**
 * Gap shown as «не замкнуто»: user outer inputs when present, otherwise axis chain.
 * When outer inputs kinematically close (|gap| < 1 mm), hide translation-induced axis gap.
 */
export function effectiveClosureGapMmForDisplay(
  edges: FixedEdge[],
  options?: {
    usesOuterLengths?: boolean
    outerLengthMm?: (edge: FixedEdge, index: number) => number | undefined
  },
): number {
  const axisGap = closureGap(edges).distMm
  if (!options?.usesOuterLengths || edges.length === 0) return axisGap

  const outerGap = kinematicClosureGapMm(edges, (edge, i) => {
    const explicit = edge.measuredOuterLengthMm
    if (explicit != null) return explicit
    const fromOverlay = options.outerLengthMm?.(edge, i)
    if (fromOverlay != null) return fromOverlay
    return edge.lengthMm
  })

  if (outerGap <= INPUT_CLOSURE_TOLERANCE_MM) {
    return axisGap <= INPUT_CLOSURE_TOLERANCE_MM ? axisGap : 0
  }
  return outerGap
}
