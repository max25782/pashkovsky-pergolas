import type { PergolaSpec, SupportType } from './types'

export type CanonicalSupportType = 'free-standing' | 'wall-mounted' | 'hanging'

/** Vertical hanger rod drawn only in hanging mode, mm. */
export const HANGER_LENGTH_MM = 250

/**
 * Collapse the public SupportType union (plus the deprecated attachedToWall
 * flag) onto the three product modes. `'posts'` is a synonym of
 * `'free-standing'`. Wall ticks alone do NOT promote a spec — hosts must
 * set supportType: 'wall-mounted' (specFromPlan does that when the contour
 * has wall edges).
 */
export function resolveSupportType(
  spec: Pick<PergolaSpec, 'supportType' | 'attachedToWall'>,
): CanonicalSupportType {
  if (spec.supportType === 'hanging') return 'hanging'
  if (spec.supportType === 'wall-mounted' || spec.attachedToWall === true) {
    return 'wall-mounted'
  }
  return 'free-standing'
}

export function isFreeStanding(supportType: SupportType | undefined): boolean {
  return supportType === 'free-standing' || supportType === 'posts' || supportType == null
}

export function specColorHex(spec: Pick<PergolaSpec, 'color' | 'colorHex'>): string {
  const raw = spec.colorHex ?? spec.color
  return raw != null && raw.length > 0 ? raw : '#9aa0a6'
}

export function clampLamellaAngleDeg(value: number): 0 | 45 {
  return value >= 22.5 ? 45 : 0
}
