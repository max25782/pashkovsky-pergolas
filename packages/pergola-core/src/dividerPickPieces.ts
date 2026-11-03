import type { CutPiece, Point2D, ProfileDimensions } from './types'
import type { PlanConstructionParams } from './planDefaults'
import { specFromPlan } from './buildPieces'
import { isCCW } from './miter'
import { scanLineClip } from './lamellas'
import { resolvePlanPurlinLines } from './dividerEdits'
import { sanitizeContour } from './contourSanitize'
import { isHorizontalPlane, offsetAlongNormal, placeOnRoof, roofPlane } from './roof'
import { resolveLamellaPattern, patternMaxVerticalThicknessMm } from './lamellaPattern'
import { computeFrame } from './frame'
import { collectFrameBeamTrimSegments, measuredOutersForCcwContour, trimDividerAxisSegmentsForFrame } from './dividerFrameTrim'

/** Minimum axis length for 3D divider hit boxes (mm). */
export const MIN_DIVIDER_PICK_LENGTH_MM = 200

const RAD = Math.PI / 180
const HALF_PI = Math.PI / 2

export interface DividerPickDiagnostic {
  dividerId: string
  structuralSegmentCount: number
  visualSegmentCount: number
  clipSegmentCount: number
  pickZoneCount: number
  longestStructuralMm: number
  pickPieceIds: string[]
  pickLengthMm: number
  hasHighlightZone: boolean
  reason?: string
}

function pickPiecesForDividerLine(
  contour: Point2D[],
  spec: ReturnType<typeof specFromPlan>,
  profiles: Map<string, ProfileDimensions>,
  dividerId: string,
  positionMm: number,
  options?: {
    wingShelfClip?: { start: Point2D; end: Point2D; halfWidthMm?: number }
    wingShelfClips?: Array<{ start: Point2D; end: Point2D; halfWidthMm?: number }>
  },
): CutPiece[] {
  const purlinProfileId = spec.purlinProfileId
  if (!purlinProfileId) return []
  const purlinProfile = profiles.get(purlinProfileId)
  if (!purlinProfile) return []

  const plane = roofPlane(spec)
  const sloped = !isHorizontalPlane(plane)
  const pattern = resolveLamellaPattern(spec, profiles)
  const aboveLamellaMm = purlinProfile.interruptsLamella === true ? 0 : patternMaxVerticalThicknessMm(pattern)
  const baseYmm = spec.heightMm + aboveLamellaMm

  const cleanContour = sanitizeContour(contour)
  const pts: Point2D[] = isCCW(cleanContour) ? cleanContour : [...cleanContour].reverse()
  const measuredCcw = measuredOutersForCcwContour(cleanContour, spec.measuredOuterLengthMmByEdgeIndex)
  const θ = spec.lamellaDirectionDeg * RAD
  const dir: Point2D = [Math.cos(θ), Math.sin(θ)]
  const perp: Point2D = [-Math.sin(θ), Math.cos(θ)]

  const frameBeams = profiles.get(spec.beamProfileId) != null ? computeFrame(spec, profiles).beams : []
  const beamTrim = collectFrameBeamTrimSegments(frameBeams, profiles, {
    contour: pts,
    measuredOuterLengthMmByEdgeIndex: measuredCcw,
    layoutVersion: spec.purlinClearLayoutVersion === 1 ? 1 : undefined,
  })

  const anchor: Point2D = [dir[0] * positionMm, dir[1] * positionMm]
  const hits = scanLineClip(perp, dir, positionMm, anchor, pts)

  const pieces: CutPiece[] = []
  let seg = 0
  for (let k = 0; k + 1 < hits.length; k += 2) {
    const clipStart: Point2D = [
      anchor[0] + hits[k].s * perp[0],
      anchor[1] + hits[k].s * perp[1],
    ]
    const clipEnd: Point2D = [
      anchor[0] + hits[k + 1].s * perp[0],
      anchor[1] + hits[k + 1].s * perp[1],
    ]

    const trimmed = trimDividerAxisSegmentsForFrame({
      start: clipStart,
      end: clipEnd,
      beams: beamTrim,
      minLengthMm: 1,
      wingShelfClip: options?.wingShelfClip,
      wingShelfClips: options?.wingShelfClips,
      contour: pts,
      measuredOuterLengthMmByEdgeIndex: measuredCcw,
      ignoreBeamsBehindEnds: true,
    })
    if (trimmed.length === 0) continue

    for (const part of trimmed) {
      const startPt = part.start
      const endPt = part.end
      const len = part.lengthAxisMm
      const axisMm = Math.max(len, MIN_DIVIDER_PICK_LENGTH_MM)
    const placed = sloped ? placeOnRoof(startPt, endPt, plane) : null
      pieces.push({
        id: `pick-${dividerId}-${seg}`,
        role: 'purlin',
        dividerId,
        profileId: purlinProfileId,
        lengthAxisMm: axisMm,
        lengthLongMm: axisMm,
        lengthShortMm: axisMm,
        cutMiterStartDeg: 0,
        cutBevelStartDeg: 0,
        cutHandStart: 'straight',
        cutMiterEndDeg: 0,
        cutBevelEndDeg: 0,
        cutHandEnd: 'straight',
        position: placed
          ? offsetAlongNormal(placed.position, plane, aboveLamellaMm)
          : [startPt[0], baseYmm, startPt[1]],
        rotation: placed?.rotation ?? [0, -(θ + HALF_PI), 0],
        color: spec.color ?? '#9aa0a6',
      })
      seg += 1
    }
  }
  return pieces
}

/** Pick targets for every contour clip segment of each divider line (non-convex roofs get one zone per wing). */
export function buildDividerPickPieces(
  contour: Point2D[],
  params: PlanConstructionParams,
  profiles: Map<string, ProfileDimensions>,
  options?: {
    wingShelfClip?: { start: Point2D; end: Point2D; halfWidthMm?: number }
    wingShelfClips?: Array<{ start: Point2D; end: Point2D; halfWidthMm?: number }>
    wallEdgeIndices?: number[]
  },
): CutPiece[] {
  const wallEdgeIndices = options?.wallEdgeIndices ?? []
  const spec = specFromPlan({ contour, wallEdgeIndices, params })
  const lines = resolvePlanPurlinLines(contour, params, profiles, wallEdgeIndices)
  const out: CutPiece[] = []
  for (const line of lines) {
    out.push(...pickPiecesForDividerLine(contour, spec, profiles, line.id, line.positionMm, options))
  }
  return out
}

export function uniqueDividerIdsWithPickZones(pickPieces: CutPiece[]): Set<string> {
  const ids = new Set<string>()
  for (const p of pickPieces) {
    if (p.dividerId) ids.add(p.dividerId)
  }
  return ids
}

export function diagnoseDividerPicking(input: {
  contour: Point2D[]
  params: PlanConstructionParams
  profiles: Map<string, ProfileDimensions>
  structuralPurlins: CutPiece[]
  visualPurlins: CutPiece[]
}): DividerPickDiagnostic[] {
  const { contour, params, profiles, structuralPurlins, visualPurlins } = input
  const lines = resolvePlanPurlinLines(contour, params, profiles)
  const pickPieces = buildDividerPickPieces(contour, params, profiles)
  const picksByDivider = new Map<string, CutPiece[]>()
  for (const p of pickPieces) {
    if (!p.dividerId) continue
    const list = picksByDivider.get(p.dividerId) ?? []
    list.push(p)
    picksByDivider.set(p.dividerId, list)
  }

  const structuralById = new Map<string, CutPiece[]>()
  for (const p of structuralPurlins) {
    if (!p.dividerId) continue
    const list = structuralById.get(p.dividerId) ?? []
    list.push(p)
    structuralById.set(p.dividerId, list)
  }
  const visualById = new Map<string, CutPiece[]>()
  for (const p of visualPurlins) {
    if (!p.dividerId) continue
    const list = visualById.get(p.dividerId) ?? []
    list.push(p)
    visualById.set(p.dividerId, list)
  }

  return lines.map((line) => {
    const structural = structuralById.get(line.id) ?? []
    const visual = visualById.get(line.id) ?? []
    const longestStructuralMm = structural.length
      ? Math.max(...structural.map((p) => p.lengthAxisMm))
      : 0
    const picks = picksByDivider.get(line.id) ?? []
    const clipSegmentCount = picks.length
    let reason: string | undefined
    if (structural.length === 0) {
      reason = 'no structural CutPiece (clip empty or below BOM MIN_SEGMENT_MM)'
    } else if (longestStructuralMm < MIN_DIVIDER_PICK_LENGTH_MM) {
      reason = `structural segment shorter than pick minimum (${Math.round(longestStructuralMm)}mm)`
    } else if (structural.length > 1 && picks.length < structural.length) {
      reason = 'fewer pick zones than structural segments (clip mismatch)'
    }
    const visualWithId = visual.filter((p) => p.dividerId === line.id)
    const visualRaycast = visualWithId.length > 0
    const longestPickMm = picks.length ? Math.max(...picks.map((p) => p.lengthAxisMm)) : 0
    return {
      dividerId: line.id,
      structuralSegmentCount: structural.length,
      visualSegmentCount: visual.length,
      clipSegmentCount,
      pickZoneCount: picks.length,
      longestStructuralMm,
      pickPieceIds: picks.map((p) => p.id),
      pickLengthMm: longestPickMm,
      hasHighlightZone: picks.length > 0,
      reason: picks.length > 0
        ? reason
          ? `${reason}; ${picks.length} pick zone(s)`
          : visualRaycast
            ? `${picks.length} pick zone(s) + visual mesh raycast`
            : `${picks.length} pick zone(s) (visual mesh has no dividerId or is LED)`
        : reason ?? 'scanLineClip found no interval for this line',
    }
  })
}

export function logDividerPickingDiagnostics(
  contour: Point2D[],
  params: PlanConstructionParams,
  profiles: Map<string, ProfileDimensions>,
  structuralPurlins: CutPiece[],
  visualPurlins: CutPiece[],
): void {
  const pickPieces = buildDividerPickPieces(contour, params, profiles)
  const rows = diagnoseDividerPicking({
    contour,
    params,
    profiles,
    structuralPurlins,
    visualPurlins,
  })
  const segmentCounts = new Map<string, number>()
  for (const p of structuralPurlins) {
    if (!p.dividerId) continue
    segmentCounts.set(p.dividerId, (segmentCounts.get(p.dividerId) ?? 0) + 1)
  }
  const picksByDivider = new Map<string, CutPiece[]>()
  for (const p of pickPieces) {
    if (!p.dividerId) continue
    const list = picksByDivider.get(p.dividerId) ?? []
    list.push(p)
    picksByDivider.set(p.dividerId, list)
  }
  const purlinLog = [...structuralPurlins, ...visualPurlins].map((p) => {
    const dividerId = p.dividerId ?? null
    const zones = dividerId ? (picksByDivider.get(dividerId) ?? []) : []
    return {
      id: p.id,
      dividerId,
      lengthAxisMm: Math.round(p.lengthAxisMm),
      position: p.position.map((n) => Math.round(n)),
      role: p.role,
      source: structuralPurlins.includes(p) ? 'structural' : 'visual',
      segmentsForDividerId: dividerId ? (segmentCounts.get(dividerId) ?? 0) : 0,
      pickZoneIds: zones.map((z) => z.id),
      pickZoneCountForDivider: zones.length,
      hasRaycastMesh: zones.length > 0,
    }
  })
  const lineIds = rows.map((r) => r.dividerId)
  console.info('[dividers] purlin CutPieces', purlinLog)
  console.info('[dividers] pick diagnostics', {
    resolvedDividerCount: lineIds.length,
    resolvedDividerIds: lineIds,
    pickMeshCount: pickPieces.length,
    uniqueDividerIdsWithPick: [...uniqueDividerIdsWithPickZones(pickPieces)],
    rows,
  })
  const missing = rows.filter((r) => !r.hasHighlightZone)
  if (missing.length > 0) {
    console.warn('[dividers] missing pick zones', missing)
  }
}
