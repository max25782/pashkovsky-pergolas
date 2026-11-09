import type { CutPiece, PergolaSpec, PieceWarning, Point2D, ProfileDimensions } from './types'
import type { StructuralIssue } from './validation'
import type { PlanConstructionParams } from './planDefaults'
import { DEFAULT_PLAN_CONSTRUCTION_PARAMS } from './planDefaults'
import { resolveAllWingShelfSupports } from './planEditorDimensions'
import { computeFrame } from './frame'
import { computeLamellas } from './lamellas'
import { computePurlins } from './purlins'
import { segmentBeamsForStock, segmentRunPiecesForStock, type StockJoint } from './beamSegmentation'
import { validateLamellaSpans } from './validation'
import { DEFAULT_KERF_MM } from './packProfile'
import { DEFAULT_VISTUR_TOLERANCES } from './visturTolerances'
import { resolveLamellaPatternIds } from './lamellaPresets'
import { clampLamellaAngleDeg, resolveSupportType, specColorHex } from './support'
import type { SupportType } from './types'
import type { RoofPlane } from './roof'
import { postHeightMm } from './roof'
import { isAutoAddedDividerId, resolveContourPurlinPositions } from './lamellaSpans'
import { withOverhangDividers, type BuildLamellaSectionsOptions } from './lamellaSections'
import { planLamellaZones } from './lamellaZones'
import { resolveLamellaPattern, patternMaxLamellaSpanMm } from './lamellaPattern'
import type { SupportBeamsDocument } from './supportBeams'
import {
  applyStraightSupportBeamsToPieces,
  hasPlanSupportBeams,
  resolveStraightSupportBeams,
} from './supportBeams'

export interface BuiltPieces {
  pieces: CutPiece[]
  /** Structural divider lines from computePurlins (always have dividerId). */
  structuralPurlins: CutPiece[]
  warnings: PieceWarning[]
  /** Stock splices (position + profile). Fasteners are counted later — not added to BOM here. */
  joints: StockJoint[]
  /**
   * Dividers the builder added itself (ids `div-auto-*`) so a slanted end does not
   * leave a lamella over the span limit. Drawings mark these as added automatically.
   */
  autoDividers: Array<{ id: string; positionMm: number }>
  isOrthogonal: boolean
  colorHex: string
  heightMm: number
  roof: RoofPlane
}

export interface SpecFromPlanInput {
  contour: Point2D[]
  wallEdgeIndices: number[]
  params: PlanConstructionParams
  /** Top-level plan field; omit for plans without beams. */
  supportBeams?: SupportBeamsDocument
}

/**
 * Hosts pass wall-mounted when the contour has wall-marked edges, unless
 * the operator explicitly chose hanging.
 */
export function planSupportType(
  params: Pick<PlanConstructionParams, 'supportType'>,
  wallEdgeIndices: number[],
): SupportType {
  if (params.supportType === 'hanging') return 'hanging'
  if (params.supportType === 'wall-mounted' || wallEdgeIndices.length > 0) {
    return 'wall-mounted'
  }
  return 'free-standing'
}

export function specFromPlan(input: SpecFromPlanInput): PergolaSpec {
  const {
    postMaxSpanMm: _ignoredDefault,
    purlinClearLayoutVersion: _ignoredLayout,
    lamellaSectionLayoutVersion: _ignoredSections,
    purlinMaxSpanMm: _ignoredPurlinMax,
    wingShelfProfileId: _ignoredShelfProfile,
    wallBeamWidthVersion: _ignoredWallWidth,
    wallProfileId: _ignoredWallProfile,
    frameJointVersion: _ignoredJoints,
    skewSectionVersion: _ignoredSkew,
    overhangDividerVersion: _ignoredOverhang,
    lamellaLengthStepMm: _ignoredStep,
    ...planDefaults
  } = DEFAULT_PLAN_CONSTRUCTION_PARAMS
  const params = { ...planDefaults, ...input.params }
  const pattern = resolveLamellaPatternIds(params.lamellaPatternId, params.lamellaWallThicknessMm)
  const supportType = planSupportType(params, input.wallEdgeIndices)
  const colorHex = params.colorHex
  return {
    contour: input.contour,
    heightMm: params.heightMm,
    lamellaGapMm: params.lamellaGapMm,
    lamellaAngleDeg: clampLamellaAngleDeg(params.lamellaAngleDeg),
    lamellaDirectionDeg: params.lamellaDirectionDeg,
    lamellaOnEdge: params.lamellaOnEdge,
    postProfileId: params.postProfileId,
    beamProfileId: params.beamProfileId,
    lamellaProfileId: pattern[0],
    lamellaPattern: [...pattern],
    purlinProfileId: params.purlinProfileId || undefined,
    wallEdgeIndices: input.wallEdgeIndices,
    supportType,
    color: colorHex.startsWith('#') ? colorHex : '#9aa0a6',
    colorHex,
    visturTolerances: params.visturMode ? DEFAULT_VISTUR_TOLERANCES : undefined,
    slope: params.slope,
    highEdgeIndex: params.highEdgeIndex,
    postHeightOverridesMm: params.postHeightOverridesMm,
    purlinDividers: params.purlinDividers,
    ...(params.postMaxSpanMm != null ? { postMaxSpanMm: params.postMaxSpanMm } : {}),
    ...(params.purlinClearLayoutVersion === 1 ? { purlinClearLayoutVersion: 1 as const } : {}),
    ...(params.lamellaSectionLayoutVersion === 1 ? { lamellaSectionLayoutVersion: 1 as const } : {}),
    ...(params.purlinMaxSpanMm != null ? { purlinMaxSpanMm: params.purlinMaxSpanMm } : {}),
    ...(params.wingShelfProfileId ? { wingShelfProfileId: params.wingShelfProfileId } : {}),
    ...(params.wallBeamWidthVersion === 1
      ? {
          wallBeamWidthVersion: 1 as const,
          wallProfileId: params.wallProfileId,
        }
      : {}),
    ...(params.measuredOuterLengthMmByEdgeIndex
      ? { measuredOuterLengthMmByEdgeIndex: params.measuredOuterLengthMmByEdgeIndex }
      : {}),
    ...(params.contourReference === 'outer-faces' || params.contourReference === 'centerline'
      ? { contourReference: params.contourReference }
      : {}),
    ...(params.frameJointVersion === 1 ? { frameJointVersion: 1 as const } : {}),
    ...(params.skewSectionVersion === 1 ? { skewSectionVersion: 1 as const } : {}),
    ...(params.overhangDividerVersion === 1 ? { overhangDividerVersion: 1 as const } : {}),
    ...(typeof params.lamellaLengthStepMm === 'number' && params.lamellaLengthStepMm > 0
      ? { lamellaLengthStepMm: params.lamellaLengthStepMm }
      : {}),
    ...(hasPlanSupportBeams(input.supportBeams) ? { supportBeams: input.supportBeams } : {}),
    ...(params.lamellaZones != null && params.lamellaZones.length > 0
      ? { lamellaZones: params.lamellaZones }
      : {}),
  }
}

/**
 * Single pipeline used by every 3D/cut-list host: frame → lamellas → LED
 * reversal → beam stock split → structural validation.
 */
export function buildPieces(
  spec: PergolaSpec,
  profiles: Map<string, ProfileDimensions>,
  options?: { kerfMm?: number } & BuildLamellaSectionsOptions,
): BuiltPieces {
  const kerfMm = options?.kerfMm ?? DEFAULT_KERF_MM
  const resolvedBeams = resolveStraightSupportBeams(spec, profiles)
  // Do not inject planSupportLine into section options: buildLamellaSections
  // already merges wing shelves + all plan beams. Passing only the first beam
  // would suppress the auto right shelf on a U-notch.
  const sectionOptions: BuildLamellaSectionsOptions | undefined =
    options?.supportLine !== undefined ? { supportLine: options.supportLine } : undefined
  const plainFrame = computeFrame(spec, profiles)
  const roof = plainFrame.roof
  // Zones: the part outside them goes through the unchanged calculation as its
  // own spec; each zone adds its own lamellas and dividers; the cut lines get
  // the beam line the full frame lacks. No zones ⇒ this block does nothing.
  const zonePlan = planLamellaZones(spec, profiles, roof, plainFrame)
  const frame = zonePlan == null
    ? plainFrame
    : {
        ...plainFrame,
        beams: [...plainFrame.beams, ...zonePlan.junctionBeams],
        posts: [...plainFrame.posts, ...zonePlan.junctionPosts],
      }
  // A slanted end can leave the last bay over the lamella span limit: the
  // builder adds the dividers that fix it (ids `div-auto-*`, listed in `autoDividers`).
  const pipelineSpec = withOverhangDividers(zonePlan?.mainSpec ?? spec, profiles)
  const lamellaSpec = zonePlan == null ? pipelineSpec : zonePlan.mainSpec == null ? null : pipelineSpec
  const lamellas = [
    ...(lamellaSpec != null ? computeLamellas(lamellaSpec, profiles, roof, sectionOptions) : []),
    ...(zonePlan?.zoneLayouts.flatMap((layout) => layout.lamellas) ?? []),
  ]
  let structuralPurlins = [
    ...(lamellaSpec != null
      ? computePurlins(pipelineSpec, profiles, roof, zonePlan == null ? { frameBeams: frame.beams } : undefined)
      : []),
    ...(zonePlan?.zoneLayouts.flatMap((layout) => layout.purlins) ?? []),
  ]
  // Split purlins on support beams BEFORE stock segmentation so a 6 m stock
  // joint does not survive across the beam (house right wing).
  if (resolvedBeams.length > 0) {
    structuralPurlins = applyStraightSupportBeamsToPieces({
      pieces: structuralPurlins,
      spec,
      profiles,
      resolved: resolvedBeams,
    })
  }
  const wingShelfPosts = buildWingShelfSupportPosts(spec, profiles, frame.beams, frame.roof)
  const beamResult = segmentBeamsForStock(spec, frame, [...lamellas, ...structuralPurlins], profiles, kerfMm)
  const runResult = segmentRunPiecesForStock(
    spec,
    structuralPurlins,
    beamResult.posts,
    [...beamResult.beams, ...lamellas],
    profiles,
    kerfMm,
    undefined,
    roof,
  )
  const purlins = stampDividerIds(runResult.pieces, structuralPurlins, spec)

  const structuralIssues = validateLamellaSpans(lamellas, profiles)
  // A lamella span over the profile limit never blocks the build (3D, cut list,
  // PDF): it is reported as a warning only, so the user decides.
  const warnings = structuralIssues.length > 0
    ? warningsFromSpanIssues(structuralIssues, lamellas, pipelineSpec, profiles)
    : []

  const pieces = [
    ...beamResult.beams,
    ...runResult.posts,
    ...wingShelfPosts,
    ...frame.hangers,
    ...lamellas,
    ...purlins,
  ]

  return {
    pieces,
    structuralPurlins,
    warnings,
    joints: [...beamResult.joints, ...runResult.joints],
    autoDividers: (pipelineSpec.purlinDividers?.mode !== 'manual' ? (pipelineSpec.purlinDividers?.lines ?? []) : [])
      .filter((line) => isAutoAddedDividerId(line.id))
      .map((line) => ({ id: line.id, positionMm: line.positionMm })),
    isOrthogonal: frame.isOrthogonal,
    colorHex: specColorHex(spec),
    heightMm: spec.heightMm,
    roof,
  }
}

const DIVIDER_MATCH_MM = 40

function stampDividerIds(
  pieces: CutPiece[],
  structural: CutPiece[],
  spec: PergolaSpec,
): CutPiece[] {
  const θ = (spec.lamellaDirectionDeg * Math.PI) / 180
  const dir0 = Math.cos(θ)
  const dir1 = Math.sin(θ)
  const lineT = (piece: CutPiece) => piece.position[0] * dir0 + piece.position[2] * dir1
  const lines = structural
    .filter((piece) => typeof piece.dividerId === 'string' && piece.dividerId.length > 0)
    .map((piece) => ({ id: piece.dividerId as string, t: lineT(piece) }))
  return pieces.map((piece) => {
    if (piece.dividerId) return piece
    const t = lineT(piece)
    const match = lines.find((line) => Math.abs(line.t - t) <= DIVIDER_MATCH_MM)
    return match ? { ...piece, dividerId: match.id } : piece
  })
}

function warningsFromSpanIssues(
  issues: StructuralIssue[],
  lamellas: CutPiece[],
  spec: PergolaSpec,
  profiles: Map<string, ProfileDimensions>,
): PieceWarning[] {
  const pattern = resolveLamellaPattern(spec, profiles)
  const positions = resolveContourPurlinPositions({
    contour: spec.contour,
    lamellaDirectionDeg: spec.lamellaDirectionDeg,
    maxSpanMm: patternMaxLamellaSpanMm(pattern),
    mode: spec.purlinDividers?.mode,
    lines: spec.purlinDividers?.lines,
    profiles,
    beamProfileId: spec.beamProfileId,
    wallProfileId: spec.wallProfileId,
    wallEdgeIndices: spec.wallEdgeIndices,
    wallBeamWidthVersion: spec.wallBeamWidthVersion,
    measuredOuterLengthMmByEdgeIndex: spec.measuredOuterLengthMmByEdgeIndex,
    layoutVersion: spec.purlinClearLayoutVersion === 1 ? 1 : undefined,
  })
  const θ = (spec.lamellaDirectionDeg * Math.PI) / 180
  const dir0 = Math.cos(θ)
  const dir1 = Math.sin(θ)

  return issues.map((issue) => {
    const piece = lamellas.find((p) => p.id === issue.pieceId)
    let spanStartMm = 0
    let spanEndMm = issue.spanMm
    if (piece) {
      spanStartMm = piece.position[0] * dir0 + piece.position[2] * dir1
      spanEndMm = spanStartMm + piece.lengthAxisMm
    }
    const startDivider = [...positions].reverse().find((p) => p.positionMm <= spanStartMm + 1) ?? null
    const endDivider = positions.find((p) => p.positionMm >= spanEndMm - 1) ?? null
    return {
      type: 'lamella-span-exceeds-max',
      message: issue.message,
      pieceId: issue.pieceId,
      profileId: issue.profileId,
      spanMm: issue.spanMm,
      maxSpanMm: issue.maxSpanMm,
      startDividerId: startDivider?.id ?? null,
      endDividerId: endDivider?.id ?? null,
      spanStartMm,
      spanEndMm,
    }
  })
}

function buildWingShelfSupportPosts(
  spec: PergolaSpec,
  profiles: Map<string, ProfileDimensions>,
  beams: CutPiece[],
  roof: RoofPlane,
): CutPiece[] {
  const supports = resolveAllWingShelfSupports({
    contour: spec.contour,
    params: {
      ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      lamellaDirectionDeg: spec.lamellaDirectionDeg,
      beamProfileId: spec.beamProfileId,
      postProfileId: spec.postProfileId,
      purlinProfileId: spec.purlinProfileId ?? DEFAULT_PLAN_CONSTRUCTION_PARAMS.purlinProfileId,
      purlinDividers: spec.purlinDividers ?? { mode: 'auto' },
      measuredOuterLengthMmByEdgeIndex: spec.measuredOuterLengthMmByEdgeIndex,
      purlinClearLayoutVersion: spec.purlinClearLayoutVersion,
      purlinMaxSpanMm: spec.purlinMaxSpanMm,
      postMaxSpanMm: spec.postMaxSpanMm,
      wingShelfProfileId: spec.wingShelfProfileId,
      wallProfileId: spec.wallProfileId,
      wallBeamWidthVersion: spec.wallBeamWidthVersion,
    },
    profiles,
    beams,
    wallEdgeIndices: spec.wallEdgeIndices,
  })
  const color = specColorHex(spec)
  const out: CutPiece[] = []
  let postIdx = 0
  for (const support of supports) {
    for (const plan of support.postPlanPoints) {
      const id = `post-wing-shelf-${postIdx++}`
      const h = postHeightMm(spec, roof, id, plan)
      out.push({
        id,
        role: 'post' as const,
        profileId: spec.postProfileId,
        lengthAxisMm: h,
        lengthLongMm: h,
        lengthShortMm: h,
        cutMiterStartDeg: 0,
        cutBevelStartDeg: 0,
        cutHandStart: 'straight' as const,
        cutMiterEndDeg: 0,
        cutBevelEndDeg: 0,
        cutHandEnd: 'straight' as const,
        position: [plan[0], 0, plan[1]] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
        color,
      })
    }
  }
  return out
}

export function buildPiecesFromPlan(
  input: SpecFromPlanInput,
  profiles: Map<string, ProfileDimensions>,
  options?: { kerfMm?: number } & BuildLamellaSectionsOptions,
): BuiltPieces {
  return buildPieces(specFromPlan(input), profiles, options)
}

export { resolveSupportType, specColorHex }
