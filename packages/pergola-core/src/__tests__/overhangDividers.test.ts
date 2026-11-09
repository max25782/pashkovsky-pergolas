/**
 * The grid of dividers is laid on the straight side of a strip; a slanted end
 * sticks out past it and the last bay came out 1410-2120 mm long, over the
 * 1400 mm span limit (25 warnings, 26 with the wing zone). The builder now adds
 * the dividers that keep every lamella inside the limit.
 */
import { describe, expect, it } from 'vitest'
import { SLANTED_WING_CONTOUR_MM } from '../acceptance/slantedWingContour'
import {
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  PERGOLA_CONSTRUCTION_PROFILES,
  buildLamellaSections,
  buildPieces,
  specFromPlan,
} from '../index'
import { isAutoAddedDividerId } from '../lamellaSpans'
import type { LamellaZone, Point2D } from '../types'

const PROFILES = PERGOLA_CONSTRUCTION_PROFILES
const SPAN_LIMIT_MM = 1400
/**
 * Plain strip: the equal grid keeps every bay under 1400. The strip left over after
 * the wing is cut out has its own grid, whose regular bays are 1407.7 (not the
 * subject here, and under the 1500 mm profile limit that raises the warning).
 */
const REMAINDER_REGULAR_BAY_MM = 1408
const WING_ZONE: LamellaZone = { id: 'wing', cutEdgeIndex: 2, lamellaEdgeIndex: 2, dividerEdgeIndex: 1 }

function wingSpec(extra: Record<string, unknown> = {}, zones = false) {
  return specFromPlan({
    contour: SLANTED_WING_CONTOUR_MM,
    wallEdgeIndices: [],
    params: {
      ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      lamellaDirectionDeg: 90,
      contourReference: 'outer-faces',
      ...(zones ? { lamellaZones: [WING_ZONE] } : {}),
      ...extra,
    } as never,
  })
}

const stripLamellas = (built: ReturnType<typeof buildPieces>) =>
  built.pieces.filter((p) => p.role === 'lamella' && !p.id.includes('-wing-'))

describe('dividers added for a slanted strip end', () => {
  for (const zones of [false, true]) {
    describe(zones ? 'with the wing zone' : 'plain strip', () => {
      const built = buildPieces(wingSpec({}, zones), PROFILES)

      it('leaves no span warning', () => {
        expect(built.warnings).toEqual([])
      })

      it('keeps every strip lamella at or under the limit', () => {
        const longest = Math.max(...stripLamellas(built).map((p) => p.lengthLongMm))
        expect(longest).toBeLessThanOrEqual(zones ? REMAINDER_REGULAR_BAY_MM : SPAN_LIMIT_MM)
      })

      it('cuts the slanted end bay down to the regular bay length', () => {
        const endBay = stripLamellas(built)
          .filter((p) => p.lengthLongMm > 0)
          .map((p) => p.lengthLongMm)
        const over = endBay.filter((length) => length > REMAINDER_REGULAR_BAY_MM)
        expect(over).toEqual([])
      })

      it('lists the added dividers and marks their ids as automatic', () => {
        expect(built.autoDividers.length).toBeGreaterThan(0)
        for (const divider of built.autoDividers) expect(isAutoAddedDividerId(divider.id)).toBe(true)
        const purlinIds = new Set(built.structuralPurlins.map((p) => p.dividerId))
        for (const divider of built.autoDividers) expect(purlinIds.has(divider.id)).toBe(true)
      })

      it('shows the same dividers in the factory sections (no section over the limit)', () => {
        const sections = buildLamellaSections(wingSpec({}, zones), PROFILES).filter((s) => !s.zoneId)
        for (const section of sections) {
          const lengths = section.trapezoid?.lamellaLengthsMm ?? [section.widthMm]
          expect(Math.max(...lengths)).toBeLessThanOrEqual(zones ? REMAINDER_REGULAR_BAY_MM : SPAN_LIMIT_MM)
        }
      })
    })
  }

  it('does nothing for a saved plan without overhangDividerVersion', () => {
    const built = buildPieces(wingSpec({ overhangDividerVersion: undefined }), PROFILES)
    expect(built.autoDividers).toEqual([])
    expect(built.warnings.length).toBeGreaterThan(0)
  })

  it('does nothing for rectangles and for manual dividers', () => {
    const rect: Point2D[] = [[0, 0], [9000, 0], [9000, 4000], [0, 4000]]
    for (const dir of [0, 90]) {
      const spec = specFromPlan({
        contour: rect,
        wallEdgeIndices: [],
        params: { ...DEFAULT_PLAN_CONSTRUCTION_PARAMS, lamellaDirectionDeg: dir, contourReference: 'outer-faces' },
      })
      expect(buildPieces(spec, PROFILES).autoDividers).toEqual([])
    }
    const manual = buildPieces(wingSpec({ purlinDividers: { mode: 'manual', lines: [] } }), PROFILES)
    expect(manual.autoDividers).toEqual([])
  })
})
