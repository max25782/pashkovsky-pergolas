import type { LamellaAngleDeg, PlanPurlinDividers, RoofSlope, SupportType } from './types'
import type { LamellaWallThicknessMm } from './pergolaProfiles'
import { DEFAULT_ROOF_SLOPE } from './roof'
import type { PurlinClearLayoutVersion } from './lamellaSpans'
import { PURLIN_CLEAR_LAYOUT_VERSION } from './lamellaSpans'

/** Current JSON schema for `Pergola.plan` stored in `pergolas_data`. */
export const PERGOLA_PLAN_SCHEMA_VERSION = 1

export interface PlanConstructionParams {
  lamellaPatternId: string
  lamellaGapMm: number
  lamellaDirectionDeg: number
  lamellaOnEdge: boolean
  beamProfileId: string
  purlinProfileId: string
  postProfileId: string
  visturMode: boolean
  heightMm: number
  lamellaAngleDeg: LamellaAngleDeg
  /** `#RRGGBB`, `RAL7016`, or `wood` / `wood:oak`. */
  colorHex: string
  supportType: Exclude<SupportType, 'posts'>
  slope: RoofSlope
  highEdgeIndex: number
  postHeightOverridesMm: Record<string, number>
  /** Wall thickness for 70×20 lamellas. Default 0.8 (supplier f7020). */
  lamellaWallThicknessMm: LamellaWallThicknessMm
  /** `auto` = even-span grid. `manual` = persisted crossing lines. */
  purlinDividers: PlanPurlinDividers
  /**
   * Max post spacing for new plans, mm. Unset on saved plans ⇒ legacy
   * beam-profile maxSpanMm (do not migrate).
   */
  postMaxSpanMm?: number
  /**
   * Site-measured outer face per contour edge (polygon[i] → polygon[i+1]), mm.
   * Unset / null entry ⇒ formula in `buildTopPlanDimensionModel`.
   */
  measuredOuterLengthMmByEdgeIndex?: Array<number | null>
  /**
   * `1` = equal clears from entered L_outer (inner face = axis ± w/2 when
   * the contour is a centerline). Unset on saved plans ⇒ legacy full-width
   * inset from the axis (do not migrate).
   */
  purlinClearLayoutVersion?: PurlinClearLayoutVersion
  /**
   * `1` = factory lamella sections on «פריסת למלות». Unset on saved plans
   * ⇒ legacy continuous rows (do not migrate).
   */
  lamellaSectionLayoutVersion?: 1
  /**
   * Auto wing-shelf support when a divider's free span exceeds this, mm.
   * Unset on saved plans ⇒ no auto shelf (legacy). New plans: 4000.
   */
  purlinMaxSpanMm?: number
  /**
   * Profile for the auto wing-shelf support. New plans: f10040 (100×40).
   * An explicit id, including a retired or disallowed one, is kept.
   * Unset on a saved plan stays unset.
   */
  wingShelfProfileId?: string
  /**
   * `1` = per-side plan width; wall sides forced to 40 mm (100×40 / 120×40).
   * Unset on saved plans ⇒ do not migrate.
   */
  wallBeamWidthVersion?: 1
  /** Profile on wall sides when `wallBeamWidthVersion === 1`. Only 100×40 or 120×40. */
  wallProfileId?: string
  /**
   * `1` = beam ends from wall flags. Unset on saved plans ⇒ do not migrate.
   */
  frameJointVersion?: 1
  /**
   * `1` = a cell whose end is not within 1.5° of 90° is a trapezoid, and
   * each lamella uses the narrowest clearance in its own row. Unset on
   * saved plans ⇒ one rectangle width (do not migrate).
   */
  skewSectionVersion?: 1
  /**
   * Lamella cut lengths on a trapezoid section are floored to this step, mm.
   * Unset ⇒ 1.
   */
  lamellaLengthStepMm?: number
}

export const DEFAULT_PLAN_CONSTRUCTION_PARAMS: PlanConstructionParams = {
  lamellaPatternId: 'all-70',
  lamellaGapMm: 20,
  lamellaDirectionDeg: 0,
  lamellaOnEdge: false,
  visturMode: false,
  beamProfileId: 'f10040',
  purlinProfileId: 'PA3022',
  postProfileId: 'f8080',
  heightMm: 2600,
  lamellaAngleDeg: 0,
  colorHex: '#9aa0a6',
  supportType: 'free-standing',
  slope: { ...DEFAULT_ROOF_SLOPE },
  highEdgeIndex: 0,
  postHeightOverridesMm: {},
  lamellaWallThicknessMm: 0.8,
  purlinDividers: { mode: 'auto' },
  postMaxSpanMm: 4000,
  purlinClearLayoutVersion: PURLIN_CLEAR_LAYOUT_VERSION,
  lamellaSectionLayoutVersion: 1,
  purlinMaxSpanMm: 4000,
  wingShelfProfileId: 'f10040',
  wallBeamWidthVersion: 1,
  wallProfileId: 'f10040',
  frameJointVersion: 1,
  skewSectionVersion: 1,
  lamellaLengthStepMm: 1,
}

/** JSON → optional measured outer lengths. Empty / all-null → undefined. */
export function parseMeasuredOuterLengthMmByEdgeIndex(
  raw: unknown,
): Array<number | null> | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: Array<number | null> = []
  let any = false
  for (const value of raw) {
    if (value == null) {
      out.push(null)
      continue
    }
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      out.push(Math.round(value))
      any = true
    } else {
      out.push(null)
    }
  }
  return any ? out : undefined
}

/**
 * Saved JSON onto the new-plan defaults.
 * A missing max span or support profile stays missing — those are not filled in.
 */
export function paramsFromStoredPlan(
  stored: Partial<PlanConstructionParams> | null | undefined,
): PlanConstructionParams {
  if (!stored) return { ...DEFAULT_PLAN_CONSTRUCTION_PARAMS }
  const next: PlanConstructionParams = { ...DEFAULT_PLAN_CONSTRUCTION_PARAMS, ...stored }
  if (!Object.prototype.hasOwnProperty.call(stored, 'purlinMaxSpanMm')) delete next.purlinMaxSpanMm
  if (
    !Object.prototype.hasOwnProperty.call(stored, 'wingShelfProfileId')
    || stored.wingShelfProfileId == null
    || stored.wingShelfProfileId === ''
  ) {
    delete next.wingShelfProfileId
  }
  return next
}
