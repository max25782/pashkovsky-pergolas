import type { CutPiece, PergolaSpec, Point2D, ProfileDimensions } from './types'
import type { StructuralIssue } from './validation'
import type { PlanConstructionParams } from './planDefaults'
import { DEFAULT_PLAN_CONSTRUCTION_PARAMS } from './planDefaults'
import { computeFrame } from './frame'
import { computeLamellas } from './lamellas'
import { segmentLedPurlinsForStock } from './ledPurlinReversal'
import { segmentBeamsForStock } from './beamSegmentation'
import { validateLamellaSpans } from './validation'
import { DEFAULT_KERF_MM } from './packProfile'
import { DEFAULT_VISTUR_TOLERANCES } from './visturTolerances'
import { resolveLamellaPatternIds } from './lamellaPresets'
import { clampLamellaAngleDeg, resolveSupportType, specColorHex } from './support'
import type { SupportType } from './types'

export interface BuiltPieces {
  pieces: CutPiece[]
  isOrthogonal: boolean
  colorHex: string
  heightMm: number
}

export interface SpecFromPlanInput {
  contour: Point2D[]
  wallEdgeIndices: number[]
  params: PlanConstructionParams
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
  const params = { ...DEFAULT_PLAN_CONSTRUCTION_PARAMS, ...input.params }
  const pattern = resolveLamellaPatternIds(params.lamellaPatternId)
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
  }
}

function summarizeStructuralIssues(issues: StructuralIssue[]): string {
  const lines = issues.map((issue) => {
    return `  profile "${issue.profileId}": ${issue.spanMm}mm unsupported (limit ${issue.maxSpanMm}mm)`
  })
  return (
    `Structural violation — ${issues.length} lamella piece(s) exceed their profile's maxLamellaSpanMm:\n` +
    `${lines.join('\n')}\n` +
    `Add a purlin profile with interruptsLamella: true, or a lamella profile rated for this span.`
  )
}

/**
 * Single pipeline used by every 3D/cut-list host: frame → lamellas → LED
 * reversal → beam stock split → structural validation.
 */
export function buildPieces(
  spec: PergolaSpec,
  profiles: Map<string, ProfileDimensions>,
  options?: { kerfMm?: number },
): BuiltPieces {
  const kerfMm = options?.kerfMm ?? DEFAULT_KERF_MM
  const frame = computeFrame(spec, profiles)
  const lamellas = computeLamellas(spec, profiles)
  const ledResult = segmentLedPurlinsForStock(spec, profiles, frame.posts, frame.beams, kerfMm)
  const purlins = [...ledResult.purlins, ...ledResult.dividers]
  const beamResult = segmentBeamsForStock(spec, frame, [...lamellas, ...purlins], profiles, kerfMm)

  const structuralIssues = validateLamellaSpans(lamellas, profiles)
  if (structuralIssues.length > 0) {
    throw new Error(summarizeStructuralIssues(structuralIssues))
  }
  if (beamResult.issues.length > 0 || ledResult.issues.length > 0) {
    const lines = [
      ...beamResult.issues.map((i) => `  beam "${i.pieceId}" (profile "${i.profileId}"): ${i.message}`),
      ...ledResult.issues.map((i) => `  LED purlin (profile "${i.profileId}"): ${i.message}`),
    ]
    throw new Error(`Construction gap — cannot fit onto any available stock:\n${lines.join('\n')}`)
  }

  return {
    pieces: [
      ...beamResult.beams,
      ...beamResult.posts,
      ...frame.hangers,
      ...lamellas,
      ...purlins,
    ],
    isOrthogonal: frame.isOrthogonal,
    colorHex: specColorHex(spec),
    heightMm: spec.heightMm,
  }
}

export function buildPiecesFromPlan(
  input: SpecFromPlanInput,
  profiles: Map<string, ProfileDimensions>,
  options?: { kerfMm?: number },
): BuiltPieces {
  return buildPieces(specFromPlan(input), profiles, options)
}

export { resolveSupportType, specColorHex }
