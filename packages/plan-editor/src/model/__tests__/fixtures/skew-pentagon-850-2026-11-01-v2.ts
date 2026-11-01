/**
 * Skew pentagon of 2026-11-01, version 2: the outer contour of v1 plus the drawing's
 * seven crossbeams and the one straight beam. The contour is NOT changed; v1 stays as is.
 *
 * Frames. The drawing ("target") frame has its origin on the outer corner A, X along AB,
 * Y along EA, so the long side EA is at x = 0 and the contour extends to +X. The editor plan
 * the user currently sees is the left-right mirror of it (EA on the right, contour extends
 * left; editor Y points up, so AB is at the bottom). Mirroring x' = MIRROR_X_MM - x keeps
 * every size and angle but turns the contour clockwise. `mirror = false` gives the target
 * frame (counter-clockwise), used as a diagnostic: the frame cut list of a clockwise plan is
 * wrong (contourOrientation.test.ts).
 *
 * The editor cannot store a user-placed beam that runs parallel to the lamellas. The only
 * such member the application knows is the auto wing shelf, which finds its own position
 * from the contour shape. `applyStraightBeam` below therefore assembles the beam and the
 * split of the crossbeams L6/L7 AFTER `buildPieces`, with the same cut rules the program
 * uses for a shelf (square cut on a crossing, inner face of the frame, contour miter at the
 * frame end). It is test scaffolding for the production sheet, not application behaviour.
 */
import {
  beamPlanWidthForDrawing,
  cutAtEdge,
  isCCW,
  longPointOffset,
  pieceAxis,
  WING_SHELF_SPAN_DIVIDER_ID,
} from '@pashkovsky/pergola-core'
import type { CutPiece, Point2D, ProfileDimensions } from '@pashkovsky/pergola-core'

export const SKEW_PENTAGON_850_V2_ID = 'skew-pentagon-850-2026-11-01-v2'

/** Outer contour A..E in the drawing frame, mm (user-supplied coordinates, origin at A). */
export const V2_OUTER_TARGET_MM: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [900, 0],
  [5896.2, 6876.6],
  [6292.8, 9142.2],
  [0, 9809],
]

/**
 * Beam centerline A..E in the drawing frame, mm: the outer contour moved inward by 20 mm
 * (f10040, 40 mm), corners mitred, rounded to 0.001 mm. Same polygon as the v1 fixture.
 */
export const V2_CENTERLINE_TARGET_MM: ReadonlyArray<readonly [number, number]> = [
  [20, 20],
  [889.81, 20],
  [5877.298, 6884.61],
  [6269.409, 9124.567],
  [20, 9786.769],
]

/** x of the outer face of EA in the mirrored (editor) frame, mm. */
export const V2_MIRROR_X_MM = 6289.409

/** Outer sizes as typed in the editor (AB, BC, CD, DE, EA), mm. Same for both frames. */
export const V2_TYPED_OUTER_MM = [900, 8500, 2300, 6328, 9809]

export const V2_BEAM_PLAN_WIDTH_MM = 40
export const V2_CROSSBEAM_PROFILE_ID = 'PA3022'
export const V2_FRAME_PROFILE_ID = 'f10040'
export const V2_LAMELLA_DIRECTION_DEG = 90

/** Crossbeam centrelines along EA, measured from the outer face of AB, mm. L1 is nearest AB. */
export const V2_CROSSBEAM_CENTRES_Y_MM = [1272, 2524, 3776, 5028, 6280, 7532, 8659]

/** Faces of each crossbeam (centre +- 20 mm) as given for the drawing, mm. */
export const V2_CROSSBEAM_FACES_Y_MM: ReadonlyArray<readonly [number, number]> = [
  [1252, 1292],
  [2504, 2544],
  [3756, 3796],
  [5008, 5048],
  [6260, 6300],
  [7512, 7552],
  [8639, 8679],
]

/** Clear gaps: AB frame to L1, L1..L6 (x5), L6-L7, L7 to the frame at EA. */
export const V2_EXPECTED_CLEAR_GAPS_MM = [1212, 1212, 1212, 1212, 1212, 1212, 1087, 1087]

/** Outer length of each crossbeam, from the outer face of EA to the outer face of the contour, mm. */
export const V2_EXPECTED_CROSSBEAM_OUTER_MM = [1824, 2734, 3643, 4553, 5463, 6011, 6208]

/** Which side ends each crossbeam: BC for L1..L5, CD for L6 and L7 (edge index in A..E order). */
export const V2_CROSSBEAM_END_EDGE_INDEX = [1, 1, 1, 1, 1, 2, 2]

export const V2_BEAM = {
  /** Distance from the outer face of EA to the beam axis, mm. */
  axisFromEaOuterMm: 3104.1,
  /** Start of the beam: lower face of L5, mm from the outer face of AB. */
  startYMm: 6300,
  /** End on the outer face of DE as given for the drawing, mm. */
  endYOuterMm: 9480.1,
  axisLengthToOuterMm: 3180.1,
  profileId: V2_CROSSBEAM_PROFILE_ID,
} as const

/** Expected outer length of each part of a split crossbeam: [EA side, other side], mm. */
export const V2_EXPECTED_SPLIT_OUTER_MM: Record<'row-6' | 'row-7', [number, number]> = {
  'row-6': [3104.1, 2906.8],
  'row-7': [3104.1, 3104.1],
}

export const V2_SIDE_TOLERANCE_MM = 0.5
export const V2_LENGTH_TOLERANCE_MM = 1
export const V2_OUTER_AREA_M2 = 39.27

export function pentagonV2Contour(mirror: boolean): Point2D[] {
  return V2_CENTERLINE_TARGET_MM.map(([x, y]): Point2D => (mirror ? [V2_MIRROR_X_MM - x, y] : [x, y]))
}

/**
 * Plan params that make this plan: typed outers, manual crossbeam lines (explicit positions,
 * so the app keeps them instead of laying out equal gaps), lamellas along EA.
 * Profiles: frame f10040, crossbeams PA3022; lamellas come from the shared defaults (f7020).
 */
export function pentagonV2ParamOverrides() {
  return {
    beamProfileId: V2_FRAME_PROFILE_ID,
    wallProfileId: V2_FRAME_PROFILE_ID,
    purlinProfileId: V2_CROSSBEAM_PROFILE_ID,
    lamellaDirectionDeg: V2_LAMELLA_DIRECTION_DEG,
    measuredOuterLengthMmByEdgeIndex: [...V2_TYPED_OUTER_MM],
    purlinDividers: {
      mode: 'manual' as const,
      lines: V2_CROSSBEAM_CENTRES_Y_MM.map((positionMm, i) => ({ id: `row-${i + 1}`, positionMm })),
    },
  }
}

/**
 * Auto support (wing shelf) off for this plan: `purlinMaxSpanMm` unset means "no auto shelf"
 * (types.ts). The rule stays in the application; see the shelf test for what it does here.
 */
export function withoutAutoSupport<T extends { purlinMaxSpanMm?: number }>(params: T): Omit<T, 'purlinMaxSpanMm'> {
  return Object.fromEntries(Object.entries(params).filter(([key]) => key !== 'purlinMaxSpanMm')) as Omit<
    T,
    'purlinMaxSpanMm'
  >
}

/** Construction versions a NEW plan gets (same as the production-sheet harness uses for live skew plans). */
export const V2_PLAN_DEFAULTS = {
  lamellaGapMm: 20,
  wingShelfProfileId: 'purlin-plain-5030',
  wallBeamWidthVersion: 1 as const,
  purlinClearLayoutVersion: 1 as const,
  lamellaSectionLayoutVersion: 1 as const,
  frameJointVersion: 1 as const,
}

/** Full plan params of v2 on top of the application defaults. One source for the test and the PDF harness. */
export function pentagonV2PlanParams<T extends { purlinMaxSpanMm?: number }>(defaults: T) {
  return { ...withoutAutoSupport(defaults), ...V2_PLAN_DEFAULTS, ...pentagonV2ParamOverrides() }
}

export interface StraightBeamPart {
  pieceId: string
  dividerId: string
  /** Clear length between the faces it butts on (the program's lengthAxisMm), mm. */
  axisMm: number
  longMm: number
  shortMm: number
}

export interface StraightBeamAttachment {
  /** Beam axis end on the inner face of DE (how the editor ends a straight member), mm from AB outer. */
  endYInnerFaceMm: number
  /** Beam axis end on the outer edge of DE, mm from AB outer. */
  endYOuterEdgeMm: number
  axisToInnerFaceMm: number
  axisToOuterEdgeMm: number
  endCutMiterDeg: number
  endCutHand: 'L' | 'R' | 'straight'
}

export interface StraightBeamResult {
  pieces: CutPiece[]
  beam: CutPiece
  parts: StraightBeamPart[]
  attachment: StraightBeamAttachment
}

function unitOf(a: Point2D, b: Point2D): Point2D {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
  return [(b[0] - a[0]) / len, (b[1] - a[1]) / len]
}

/** Intersection of the vertical line x = xMm with the edge line moved by `offsetMm` toward the interior. */
export function verticalHitOnOffsetEdge(edgeStart: Point2D, edgeEnd: Point2D, centroid: Point2D, offsetMm: number, xMm: number): number {
  const d = unitOf(edgeStart, edgeEnd)
  let n: Point2D = [-d[1], d[0]]
  const toCentroid = (centroid[0] - edgeStart[0]) * n[0] + (centroid[1] - edgeStart[1]) * n[1]
  if (toCentroid < 0) n = [-n[0], -n[1]]
  const px = edgeStart[0] + n[0] * offsetMm
  const py = edgeStart[1] + n[1] * offsetMm
  const t = (xMm - px) / d[0]
  return py + t * d[1]
}


/**
 * Beam as a support line for the section builder. Same axis and ends as `applyStraightBeam`,
 * without writing supportBeams into the plan model. Width is the PA3022 plan width (40 mm);
 * the section clear stops on the beam faces and then loses the usual 15 mm per side of the
 * stack (same inset as a frame or shelf joint).
 */
export function pentagonV2SectionSupportLine(input: {
  contour: Point2D[]
  mirror: boolean
  profiles: Map<string, ProfileDimensions>
}): { start: Point2D; end: Point2D; widthMm: number } {
  const { contour, mirror, profiles } = input
  const beamWidthMm = beamPlanWidthForDrawing(profiles, V2_BEAM.profileId).planWidthMm
  const frameHalf = beamPlanWidthForDrawing(profiles, V2_FRAME_PROFILE_ID).planWidthMm / 2
  const xB = mirror ? V2_MIRROR_X_MM - V2_BEAM.axisFromEaOuterMm : V2_BEAM.axisFromEaOuterMm
  const centroid: Point2D = [
    contour.reduce((sum, p) => sum + p[0], 0) / contour.length,
    contour.reduce((sum, p) => sum + p[1], 0) / contour.length,
  ]
  const endYInnerFaceMm = verticalHitOnOffsetEdge(contour[3], contour[4], centroid, frameHalf, xB)
  return {
    start: [xB, V2_BEAM.startYMm],
    end: [xB, endYInnerFaceMm],
    widthMm: beamWidthMm > 0 ? beamWidthMm : V2_BEAM_PLAN_WIDTH_MM,
  }
}

export function applyStraightBeam(input: {
  pieces: CutPiece[]
  profiles: Map<string, ProfileDimensions>
  contour: Point2D[]
  mirror: boolean
}): StraightBeamResult {
  const { pieces, profiles, contour, mirror } = input
  const beamWidthMm = beamPlanWidthForDrawing(profiles, V2_BEAM.profileId).planWidthMm
  const half = beamWidthMm / 2
  const frameHalf = beamPlanWidthForDrawing(profiles, V2_FRAME_PROFILE_ID).planWidthMm / 2
  const xB = mirror ? V2_MIRROR_X_MM - V2_BEAM.axisFromEaOuterMm : V2_BEAM.axisFromEaOuterMm

  // DE is the edge D -> E (index 3 in A..E order, both frames).
  const deStart = contour[3]
  const deEnd = contour[4]
  const centroid: Point2D = [
    contour.reduce((sum, p) => sum + p[0], 0) / contour.length,
    contour.reduce((sum, p) => sum + p[1], 0) / contour.length,
  ]
  const endYInnerFaceMm = verticalHitOnOffsetEdge(deStart, deEnd, centroid, frameHalf, xB)
  const endYOuterEdgeMm = verticalHitOnOffsetEdge(deStart, deEnd, centroid, -frameHalf, xB)
  const startY = V2_BEAM.startYMm
  const beamAxisMm = endYInnerFaceMm - startY

  // Contour miter at the DE end. `cutAtEdge` expects a counter-clockwise contour.
  const ccw = isCCW(contour) ? contour : [...contour].reverse()
  const same = (a: Point2D, b: Point2D) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6
  let deIndex = -1
  for (let i = 0; i < ccw.length; i++) {
    const a = ccw[i]
    const b = ccw[(i + 1) % ccw.length]
    if ((same(a, deStart) && same(b, deEnd)) || (same(a, deEnd) && same(b, deStart))) deIndex = i
  }
  if (deIndex < 0) throw new Error('applyStraightBeam: edge DE not found in contour')
  const endCut = cutAtEdge([0, 1], ccw, deIndex)

  const reference = pieces.find((piece) => piece.role === 'purlin' && piece.dividerId === 'row-6')
  if (!reference) throw new Error('applyStraightBeam: crossbeam row-6 not found')
  const height = reference.position[1]

  const out: CutPiece[] = []
  const parts: StraightBeamPart[] = []
  for (const piece of pieces) {
    const crosses =
      piece.role === 'purlin' &&
      piece.dividerId !== WING_SHELF_SPAN_DIVIDER_ID &&
      (() => {
        const { start, end } = pieceAxis(piece)
        const y = start[1]
        return (
          y > startY &&
          y < endYInnerFaceMm &&
          Math.min(start[0], end[0]) + half < xB &&
          xB < Math.max(start[0], end[0]) - half
        )
      })()
    if (!crosses) {
      out.push(piece)
      continue
    }
    const { start, end } = pieceAxis(piece)
    const dir = unitOf(start, end)
    // Crossbeams are perpendicular to the lamellas (along X here), so x = xB fixes the hit.
    const tHit = (xB - start[0]) / dir[0]
    const profileWidth = profiles.get(piece.profileId)?.widthMm ?? beamWidthMm
    const secondStart: Point2D = [start[0] + dir[0] * (tHit + half), start[1] + dir[1] * (tHit + half)]
    const totalAxis = piece.lengthAxisMm
    const firstAxis = tHit - half
    const secondAxis = totalAxis - (tHit + half)
    const deltaStart = longPointOffset(piece.cutMiterStartDeg, profileWidth)
    const deltaEnd = longPointOffset(piece.cutMiterEndDeg, profileWidth)
    const first: CutPiece = {
      ...piece,
      id: `${piece.id}-a`,
      lengthAxisMm: firstAxis,
      lengthLongMm: firstAxis + deltaStart,
      lengthShortMm: firstAxis - deltaStart,
      cutMiterEndDeg: 0,
      cutBevelEndDeg: 0,
      cutHandEnd: 'straight',
      clipPlanEnd: [start[0] + dir[0] * firstAxis, start[1] + dir[1] * firstAxis],
    }
    const second: CutPiece = {
      ...piece,
      id: `${piece.id}-b`,
      position: [secondStart[0], piece.position[1], secondStart[1]],
      lengthAxisMm: secondAxis,
      lengthLongMm: secondAxis + deltaEnd,
      lengthShortMm: secondAxis - deltaEnd,
      cutMiterStartDeg: 0,
      cutBevelStartDeg: 0,
      cutHandStart: 'straight',
      clipPlanStart: secondStart,
    }
    out.push(first, second)
    for (const part of [first, second]) {
      parts.push({
        pieceId: part.id,
        dividerId: piece.dividerId ?? '',
        axisMm: part.lengthAxisMm,
        longMm: part.lengthLongMm,
        shortMm: part.lengthShortMm,
      })
    }
  }

  const endDelta = longPointOffset(endCut.cutMiterDeg, beamWidthMm)
  const beam: CutPiece = {
    id: 'purlin-straight-beam',
    role: 'purlin',
    dividerId: WING_SHELF_SPAN_DIVIDER_ID,
    profileId: V2_BEAM.profileId,
    lengthAxisMm: beamAxisMm,
    lengthLongMm: beamAxisMm + endDelta,
    lengthShortMm: beamAxisMm - endDelta,
    cutMiterStartDeg: 0,
    cutBevelStartDeg: 0,
    cutHandStart: 'straight',
    cutMiterEndDeg: endCut.cutMiterDeg,
    cutBevelEndDeg: 0,
    cutHandEnd: endCut.cutHand,
    position: [xB, height, startY],
    rotation: [0, -Math.PI / 2, 0],
    color: reference.color,
    clipPlanStart: [xB, startY],
    clipPlanEnd: [xB, endYInnerFaceMm],
  }
  out.push(beam)

  return {
    pieces: out,
    beam,
    parts,
    attachment: {
      endYInnerFaceMm,
      endYOuterEdgeMm,
      axisToInnerFaceMm: beamAxisMm,
      axisToOuterEdgeMm: endYOuterEdgeMm - startY,
      endCutMiterDeg: endCut.cutMiterDeg,
      endCutHand: endCut.cutHand,
    },
  }
}
