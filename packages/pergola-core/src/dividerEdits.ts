import type { PlanConstructionParams } from './planDefaults'
import type { PlanPurlinDividerLine, Point2D, ProfileDimensions } from './types'
import { specFromPlan } from './buildPieces'
import { resolveLamellaPattern, patternMaxLamellaSpanMm } from './lamellaPattern'
import { resolveContourPurlinPositions, type ResolvedPurlinPosition } from './lamellaSpans'

function nextDividerId(existing: PlanPurlinDividerLine[], positionMm: number): string {
  const base = `div-${Math.round(positionMm)}`
  if (!existing.some((line) => line.id === base)) return base
  let n = 2
  while (existing.some((line) => line.id === `${base}-${n}`)) n += 1
  return `${base}-${n}`
}

/**
 * Changing the outer frame beam changes w_end (40 → 70 for double-T).
 * Frozen manual divider axes stay on the old grid, so middle clears do not
 * move. Drop them and let auto re-run Max equal-clear.
 */
export function beamProfileChangePatch(
  beamProfileId: string,
): Pick<PlanConstructionParams, 'beamProfileId' | 'purlinDividers' | 'purlinClearLayoutVersion'> {
  return {
    beamProfileId,
    purlinDividers: { mode: 'auto' },
    purlinClearLayoutVersion: 1,
  }
}

export function resolvePlanPurlinLines(
  contour: Point2D[],
  params: PlanConstructionParams,
  profiles: Map<string, ProfileDimensions>,
  wallEdgeIndices: number[] = [],
): ResolvedPurlinPosition[] {
  const spec = specFromPlan({ contour, wallEdgeIndices, params })
  const pattern = resolveLamellaPattern(spec, profiles)
  return resolveContourPurlinPositions({
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
}

function withManualLines(
  contour: Point2D[],
  params: PlanConstructionParams,
  profiles: Map<string, ProfileDimensions>,
  edit: (lines: PlanPurlinDividerLine[]) => PlanPurlinDividerLine[],
): PlanConstructionParams {
  if (params.purlinDividers?.mode === 'manual') {
    return {
      ...params,
      purlinDividers: {
        mode: 'manual',
        lines: edit([...(params.purlinDividers.lines ?? [])]),
      },
    }
  }
  const frozen = resolvePlanPurlinLines(contour, { ...params, purlinDividers: { mode: 'auto' } }, profiles)
  return {
    ...params,
    purlinDividers: {
      mode: 'manual',
      lines: edit(frozen.map((line) => ({ id: line.id, positionMm: line.positionMm }))),
    },
  }
}

export function movePlanDivider(
  contour: Point2D[],
  params: PlanConstructionParams,
  profiles: Map<string, ProfileDimensions>,
  dividerId: string,
  positionMm: number,
): PlanConstructionParams {
  return withManualLines(contour, params, profiles, (lines) =>
    lines.map((line) => (line.id === dividerId ? { ...line, positionMm } : line)),
  )
}

export function removePlanDivider(
  contour: Point2D[],
  params: PlanConstructionParams,
  profiles: Map<string, ProfileDimensions>,
  dividerId: string,
): PlanConstructionParams {
  return withManualLines(contour, params, profiles, (lines) =>
    lines.filter((line) => line.id !== dividerId),
  )
}

export function addPlanDivider(
  contour: Point2D[],
  params: PlanConstructionParams,
  profiles: Map<string, ProfileDimensions>,
  positionMm: number,
): PlanConstructionParams {
  return withManualLines(contour, params, profiles, (lines) => {
    const id = nextDividerId(lines, positionMm)
    return [...lines, { id, positionMm }].sort((a, b) => a.positionMm - b.positionMm)
  })
}
