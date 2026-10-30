import type { BeamPlanWidthSource, Point2D, ProfileDimensions } from './types'

/** Max rule: clear opening between purlin dividers on the top-plan chain (always 40 mm). */
export const DIVIDER_PLAN_CLEARANCE_WIDTH_MM = 40

export const BEAM_PLAN_WIDTH_FALLBACK_MM = 40

export const BEAM_PLAN_WIDTH_MISSING_WARNING =
  'нет данных о ширине в плане'

/**
 * Max rule — double-T beams: plan width 70 mm (manual override table).
 * | SKU (normalized) | nameHe | weightKgPerM (catalog) |
 * | pa1429 | דאבל טי 120 | 2.314 |
 * | r242 | דאבל טי 142/1.6 | 2.529 |
 * | pa268… | דאבל טי מעוצב (הייטק) 120 — likely «double T муцав» / מעוצב | 2.704 |
 */
const DOUBLE_T_PLAN_WIDTH_MM = 70

function normSku(sku: string | null | undefined): string {
  if (!sku) return ''
  return sku.replace(/\s+/g, '').toLowerCase()
}

const DOUBLE_T_OVERRIDE_SKUS = new Set([
  'pa1429',
  'r242',
  'pa268דאבלטימעוצב120',
])

export function isDoubleTBeamPlanWidthOverride(nameHe: string, sku: string | null | undefined): boolean {
  if (nameHe.includes('דאבל טי')) return true
  const n = normSku(sku)
  return n.length > 0 && DOUBLE_T_OVERRIDE_SKUS.has(n)
}

export interface BeamPlanWidthResolved {
  planWidthMm: number
  planWidthSource: BeamPlanWidthSource
  planWidthWarning?: string
}

/**
 * Plan-view width for **frame beam** dimension chains (smaller section side, with
 * double-T overrides). Does not change ProfileDimensions.widthMm used by 3D/BOM.
 */
export function resolveBeamPlanWidth(
  nameHe: string | undefined,
  sku: string | null | undefined,
  widthMm: number,
  heightMm: number,
): BeamPlanWidthResolved {
  if (isDoubleTBeamPlanWidthOverride(nameHe ?? '', sku)) {
    return { planWidthMm: DOUBLE_T_PLAN_WIDTH_MM, planWidthSource: 'override-70' }
  }
  if (widthMm > 0 && heightMm > 0) {
    return {
      planWidthMm: Math.min(widthMm, heightMm),
      planWidthSource: 'rule-min',
    }
  }
  return {
    planWidthMm: BEAM_PLAN_WIDTH_FALLBACK_MM,
    planWidthSource: 'fallback-40',
    planWidthWarning: BEAM_PLAN_WIDTH_MISSING_WARNING,
  }
}

export function attachBeamPlanWidth(
  profile: ProfileDimensions,
  nameHe?: string,
  sku?: string | null,
): ProfileDimensions {
  const { planWidthMm, planWidthSource, planWidthWarning } = resolveBeamPlanWidth(
    nameHe,
    sku ?? profile.sku ?? null,
    profile.widthMm,
    profile.heightMm,
  )
  return {
    ...profile,
    planWidthMm,
    planWidthSource,
    planWidthWarning,
  }
}

/** Wall sides are always 100×40 or 120×40: plan width is 40 mm, not the free-beam override. */
/**
 * Clear span between the inner faces of the two beams a member butts into.
 * Typed outer is face-to-face, so each beam is subtracted once in full.
 * A centerline axis (no separate outer) is already shorter by half of each
 * beam, so only the remaining half is subtracted — same physical length.
 */
export function innerFaceClearMm(input: {
  axisLengthMm: number
  outerLengthMm?: number | null
  startWidthMm: number
  endWidthMm: number
}): number {
  const start = input.startWidthMm > 0 ? input.startWidthMm : 0
  const end = input.endWidthMm > 0 ? input.endWidthMm : 0
  const outer = input.outerLengthMm
  if (outer != null && outer > 0) return outer - start - end
  return input.axisLengthMm - start / 2 - end / 2
}

/**
 * Shelf band on the notch side of a wall that is narrower than the free beam
 * by more than 15 mm (double-T 70 vs wall 40). The band width is the wall's
 * plan width, so its top face lands on the wall's notch-side face.
 * The 50-vs-40 case (gap ≤ 15) stays on the face and returns null.
 */
export function wingShelfFlushBandMm(
  profiles: Map<string, ProfileDimensions>,
  beamProfileId: string,
  wallProfileId: string | undefined,
  wallBeamWidthVersion: number | undefined,
): number | null {
  if (wallBeamWidthVersion !== 1 || wallProfileId == null || wallProfileId === '') return null
  const beam = beamPlanWidthForDrawing(profiles, beamProfileId).planWidthMm
  const wall = beamPlanWidthForDrawing(profiles, wallProfileId).planWidthMm
  if (!(wall > 0) || !(beam - wall > 15)) return null
  return wall
}

export const WALL_BEAM_PLAN_WIDTH_MM = 40

/** `plan.params.wallBeamWidthVersion`. Unset on saved plans ⇒ one width for every side. */
export const WALL_BEAM_WIDTH_VERSION = 1 as const
export type WallBeamWidthVersion = typeof WALL_BEAM_WIDTH_VERSION

/**
 * Catalog ids for a wall side: מלבן 40/100 (f10040) and מלבן 40/120 (pa1162).
 * The 50-wide frames (pa1197, hs012, F20050) are perimeter beams only; a wall
 * stays 40 mm wide (`sidePlanWidthMm` takes the width from the chosen id).
 */
export const WALL_BEAM_PROFILE_IDS = ['f10040', 'pa1162'] as const
export const DEFAULT_WALL_BEAM_PROFILE_ID = 'f10040'

/**
 * Support line (מריש תמיכה). Only F10040 (100×40) and 40/120/1.8 (120×40).
 * 60×40, 60×30 and 50×30 are not options and are not the default.
 */
export const supportProfileOptions = ['f10040', 'pa1162'] as const
export const DEFAULT_SUPPORT_PROFILE_ID = 'f10040'

export function isAllowedSupportProfileId(profileId: string | undefined): boolean {
  return profileId != null && profileId !== '' && (supportProfileOptions as readonly string[]).includes(profileId)
}

/** A stored support id that is not one of the two allowed profiles. Unset stays unset. */
export function supportProfileNeedsChoice(profileId: string | undefined): boolean {
  if (profileId == null || profileId === '') return false
  return !isAllowedSupportProfileId(profileId)
}

export function profileSectionLabel(
  profiles: Map<string, ProfileDimensions>,
  profileId: string,
): string {
  const profile = profiles.get(profileId)
  const plan = beamPlanWidthForDrawing(profiles, profileId).planWidthMm
  const height = profile?.heightMm && profile.heightMm > 0 ? profile.heightMm : plan
  return `${Math.round(height)}×${Math.round(plan)}`
}

/** Rows under «מסגרת»: one per distinct free/wall profile on the contour. */
export function planFrameAsideRows(
  contourLength: number,
  wallEdgeIndices: number[],
  params: {
    beamProfileId: string
    wallProfileId?: string
    wallBeamWidthVersion?: WallBeamWidthVersion
  },
  profiles: Map<string, ProfileDimensions>,
): Array<{ wall: boolean; profileId: string; size: string }> {
  const walls = new Set(wallEdgeIndices)
  const rows: Array<{ wall: boolean; profileId: string; size: string }> = []
  const seen = new Set<string>()
  for (let i = 0; i < contourLength; i++) {
    const wall = walls.has(i)
    const profileId = sideBeamProfileId({
      isWall: wall,
      beamProfileId: params.beamProfileId,
      wallProfileId: params.wallProfileId,
      wallBeamWidthVersion: params.wallBeamWidthVersion,
    })
    const key = `${wall ? 'wall' : 'free'}:${profileId}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({ wall, profileId, size: profileSectionLabel(profiles, profileId) })
  }
  return rows
}

export function isWallBeamWidthV1(version: number | undefined): version is WallBeamWidthVersion {
  return version === WALL_BEAM_WIDTH_VERSION
}

export function isAllowedWallBeamProfileId(profileId: string | undefined): boolean {
  return profileId != null && (WALL_BEAM_PROFILE_IDS as readonly string[]).includes(profileId)
}

/**
 * Profile on one contour side.
 * Version 1 + wall ⇒ 100×40 or 120×40 only. Otherwise the free beam, or a
 * legacy explicit `wallProfileId` when the side is a wall.
 */
export function sideBeamProfileId(input: {
  isWall: boolean
  beamProfileId: string
  wallProfileId?: string
  wallBeamWidthVersion?: WallBeamWidthVersion
}): string {
  if (input.isWall && isWallBeamWidthV1(input.wallBeamWidthVersion)) {
    return isAllowedWallBeamProfileId(input.wallProfileId)
      ? input.wallProfileId!
      : DEFAULT_WALL_BEAM_PROFILE_ID
  }
  if (input.isWall && input.wallProfileId) return input.wallProfileId
  return input.beamProfileId
}

/**
 * Plan width of one contour side. The only width the axis, purlin clears,
 * wing shelf, lamella cells, posts and drawings should read.
 * Version 1 + wall ⇒ the chosen wall profile's own plan width (40 for 100×40 and
 * 120×40, 50 for the 50-wide frames), never the free beam's, so a double-T 70 free
 * beam still leaves a 40 wall. Unknown wall profile ⇒ 40.
 * Unset version ⇒ the profile's own plan width (saved plans stay put).
 */
export function sidePlanWidthMm(
  profiles: Map<string, ProfileDimensions>,
  input: {
    isWall: boolean
    beamProfileId: string
    wallProfileId?: string
    wallBeamWidthVersion?: WallBeamWidthVersion
  },
): number {
  const profileId = sideBeamProfileId(input)
  if (input.isWall && isWallBeamWidthV1(input.wallBeamWidthVersion)) {
    return profiles.has(profileId)
      ? beamPlanWidthForDrawing(profiles, profileId).planWidthMm
      : WALL_BEAM_PLAN_WIDTH_MM
  }
  return beamPlanWidthForDrawing(profiles, profileId).planWidthMm
}

export function contourSideWidthMm(
  profiles: Map<string, ProfileDimensions>,
  edgeIndex: number,
  input: {
    wallEdgeIndices?: number[]
    beamProfileId: string
    wallProfileId?: string
    wallBeamWidthVersion?: WallBeamWidthVersion
  },
): number {
  const walls = input.wallEdgeIndices ?? []
  return sidePlanWidthMm(profiles, {
    isWall: walls.includes(edgeIndex),
    beamProfileId: input.beamProfileId,
    wallProfileId: input.wallProfileId,
    wallBeamWidthVersion: input.wallBeamWidthVersion,
  })
}

/**
 * Plan widths of the two frame sides that close the lamella run
 * (the perpendicular edges at the min and max projection).
 * `w_left` / `w_right` for `computeEqualPurlinClearMm`.
 */
/**
 * The two frame edges that close the lamella run (perpendicular to the
 * lamella direction, at the min and max projection). A side 2.5° off axis
 * still closes the run — `along > 0.5` keeps it, unlike a 2 mm vertical test.
 */
export function lamellaRunEndEdgeIndices(
  contour: Point2D[],
  lamellaDirectionDeg: number,
): { leftEdgeIndex: number; rightEdgeIndex: number } {
  const n = contour.length
  if (n < 2) return { leftEdgeIndex: 0, rightEdgeIndex: 0 }
  const θ = (lamellaDirectionDeg * Math.PI) / 180
  const dx = Math.cos(θ)
  const dy = Math.sin(θ)
  let leftEdge = 0
  let rightEdge = 0
  let leftProj = Infinity
  let rightProj = -Infinity
  for (let i = 0; i < n; i++) {
    const a = contour[i]
    const b = contour[(i + 1) % n]
    const ex = b[0] - a[0]
    const ey = b[1] - a[1]
    const len = Math.hypot(ex, ey)
    if (len < 1) continue
    const along = Math.abs((ex * dx + ey * dy) / len)
    if (along > 0.5) continue
    const mid = ((a[0] + b[0]) / 2) * dx + ((a[1] + b[1]) / 2) * dy
    if (mid < leftProj) {
      leftProj = mid
      leftEdge = i
    }
    if (mid > rightProj) {
      rightProj = mid
      rightEdge = i
    }
  }
  return { leftEdgeIndex: leftEdge, rightEdgeIndex: rightEdge }
}

export function lamellaRunEndWidthsMm(
  contour: Point2D[],
  lamellaDirectionDeg: number,
  profiles: Map<string, ProfileDimensions>,
  input: {
    wallEdgeIndices?: number[]
    beamProfileId: string
    wallProfileId?: string
    wallBeamWidthVersion?: WallBeamWidthVersion
  },
): { leftMm: number; rightMm: number; leftEdgeIndex: number; rightEdgeIndex: number } {
  const fallback = beamPlanWidthForDrawing(profiles, input.beamProfileId).planWidthMm
  if (contour.length < 2) {
    return { leftMm: fallback, rightMm: fallback, leftEdgeIndex: 0, rightEdgeIndex: 0 }
  }
  const ends = lamellaRunEndEdgeIndices(contour, lamellaDirectionDeg)
  return {
    leftMm: contourSideWidthMm(profiles, ends.leftEdgeIndex, input),
    rightMm: contourSideWidthMm(profiles, ends.rightEdgeIndex, input),
    leftEdgeIndex: ends.leftEdgeIndex,
    rightEdgeIndex: ends.rightEdgeIndex,
  }
}

export function purlinEndWidthOverrides(
  contour: Point2D[],
  lamellaDirectionDeg: number,
  profiles: Map<string, ProfileDimensions>,
  input: {
    wallEdgeIndices?: number[]
    beamProfileId: string
    wallProfileId?: string
    wallBeamWidthVersion?: WallBeamWidthVersion
  },
): { leftEndWidthMm: number; rightEndWidthMm: number } | undefined {
  if (!isWallBeamWidthV1(input.wallBeamWidthVersion)) return undefined
  const ends = lamellaRunEndWidthsMm(contour, lamellaDirectionDeg, profiles, input)
  return { leftEndWidthMm: ends.leftMm, rightEndWidthMm: ends.rightMm }
}

export function beamPlanWidthForDrawing(
  profiles: Map<string, ProfileDimensions>,
  profileId: string,
): { planWidthMm: number; warning?: string } {
  const profile = profiles.get(profileId)
  if (!profile) {
    return {
      planWidthMm: BEAM_PLAN_WIDTH_FALLBACK_MM,
      warning: BEAM_PLAN_WIDTH_MISSING_WARNING,
    }
  }
  if (profile.planWidthMm != null) {
    return {
      planWidthMm: profile.planWidthMm,
      warning: profile.planWidthWarning,
    }
  }
  const resolved = resolveBeamPlanWidth(
    profile.labelHe,
    profile.sku ?? null,
    profile.widthMm,
    profile.heightMm,
  )
  return { planWidthMm: resolved.planWidthMm, warning: resolved.planWidthWarning }
}

/** All beam profiles in the construction map — for reports / tests. */
export function listConstructionBeamPlanWidths(
  profiles: Map<string, ProfileDimensions>,
  beamIds: string[],
): Array<{
  profileId: string
  label: string
  sectionMm: string
  planWidthMm: number
  source: BeamPlanWidthSource
  warning?: string
}> {
  return beamIds.map((profileId) => {
    const profile = profiles.get(profileId)
    if (!profile) {
      return {
        profileId,
        label: profileId,
        sectionMm: '—',
        planWidthMm: BEAM_PLAN_WIDTH_FALLBACK_MM,
        source: 'fallback-40',
        warning: BEAM_PLAN_WIDTH_MISSING_WARNING,
      }
    }
    const { planWidthMm, warning } = beamPlanWidthForDrawing(profiles, profileId)
    const source = profile.planWidthSource ?? resolveBeamPlanWidth(
      profile.labelHe,
      profile.sku ?? null,
      profile.widthMm,
      profile.heightMm,
    ).planWidthSource
    return {
      profileId,
      label: profile.labelHe ?? profileId,
      sectionMm: `${profile.widthMm}×${profile.heightMm}`,
      planWidthMm,
      source,
      warning: profile.planWidthWarning ?? warning,
    }
  })
}
