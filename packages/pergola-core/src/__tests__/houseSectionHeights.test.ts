/**
 * House outer-faces: section H = face-to-face clear − 15 − 15.
 * Shelf / notch wall (40) lies entirely inside from the contour (down into the field).
 * Top frame is free 70 on G–H and wall 40 on C–D.
 * Collinear shelf + notch floor (~14 mm AABB tilt) merge into one mid-bay section.
 */
import { describe, expect, it } from 'vitest'
import {
  HOUSE_CONTOUR_MM,
  HOUSE_WALL_EDGE_INDICES,
  houseConstructionParams,
} from '../acceptance/houseContour'
import {
  COLLINEAR_LIMITER_STEP_TOLERANCE_MM,
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  PERGOLA_CONSTRUCTION_PROFILES,
  buildLamellaSections,
  columnHeightChecksums,
  countedLamellaRows,
  groupLamellaSectionTypes,
  mergeSteppedBays,
  reportLamellaSections,
  specFromPlan,
} from '../index'

const profiles = PERGOLA_CONSTRUCTION_PROFILES

function houseMaxSpec() {
  const clear = (9495 - 70 - 70 - 6 * 40) / 7
  const lines = Array.from({ length: 6 }, (_, i) => {
    const k = i + 1
    return { id: `div-${k}`, positionMm: 70 + k * clear + (k - 1) * 40 + 20 }
  })
  return specFromPlan({
    contour: HOUSE_CONTOUR_MM,
    wallEdgeIndices: HOUSE_WALL_EDGE_INDICES,
    params: houseConstructionParams({
      ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      lamellaDirectionDeg: 0,
      purlinMaxSpanMm: 4000,
      wingShelfProfileId: 'f10040',
      beamProfileId: 'R242',
      wallProfileId: 'pa1162',
      wallBeamWidthVersion: 1,
      purlinProfileId: 'PA3022',
      skewSectionVersion: 1,
      purlinDividers: { mode: 'manual', lines },
    }),
  })
}

describe('house outer-faces section heights', () => {
  it('upper / lower heights match free 70, wall 40, shelf 40, −30', () => {
    const spec = houseMaxSpec()
    expect(spec.contourReference).toBe('outer-faces')
    const sections = buildLamellaSections(spec, profiles)
    const rows = reportLamellaSections(sections)

    const upperLeft = rows.filter((r) => r.maxY > 7000 && (r.minX + r.maxX) / 2 < 3300)
    const upperRight = rows.filter((r) => r.maxY > 7000 && (r.minX + r.maxX) / 2 > 6700)
    const lowerLeft = rows.filter((r) => r.maxY < 5000 && (r.minX + r.maxX) / 2 < 3300)
    const lowerRight = rows.filter((r) => r.maxY < 5000 && (r.minX + r.maxX) / 2 > 6700)
    // Mid bay between purlins 2–3 spans shelf wing + under-notch as one cell.
    const midBay = rows.filter(
      (r) => r.maxY < 5000 && r.minX < 3000 && r.maxX > 3800,
    )

    expect(upperLeft.length).toBeGreaterThanOrEqual(2)
    expect(upperRight.length).toBe(2)
    expect(lowerLeft.length).toBeGreaterThanOrEqual(2)
    expect(lowerRight.length).toBe(2)
    expect(midBay.length).toBe(1)
    expect(midBay[0].widthMm).toBeGreaterThan(1200)
    expect(midBay[0].widthMm).toBeLessThan(1300)

    // 2871 − 70 − 30 = 2771 (tilt of EF ≤ ~6 mm)
    for (const r of upperLeft) expect(r.heightMm).toBeGreaterThan(2765)
    for (const r of upperLeft) expect(r.heightMm).toBeLessThan(2777)
    // 2865 − 40 − 30 = 2795
    for (const r of upperRight) expect(r.heightMm).toBeGreaterThan(2785)
    for (const r of upperRight) expect(r.heightMm).toBeLessThan(2800)
    // 7480 − 2871 − 40 − 70 − 30 = 4469; mid-bay uses min(shelf, notch) ≈ 4463
    for (const r of lowerLeft) expect(r.heightMm).toBeGreaterThan(4455)
    for (const r of lowerLeft) expect(r.heightMm).toBeLessThan(4475)
    // 7480 − 2865 − 40 − 70 − 30 = 4475
    for (const r of lowerRight) expect(r.heightMm).toBeGreaterThan(4470)
    for (const r of lowerRight) expect(r.heightMm).toBeLessThan(4480)
    expect(midBay[0].heightMm).toBeGreaterThan(4455)
    expect(midBay[0].heightMm).toBeLessThan(4475)

    // Narrow upper (J): clear ≈ 491 → width ≈ 476 (3245 − 2754; see report)
    const narrow = rows.find((r) => r.widthMm < 600 && r.maxY > 7000)
    expect(narrow).toBeTruthy()
    expect(narrow!.clearXMm).toBeGreaterThan(480)
    expect(narrow!.clearXMm).toBeLessThan(495)
    expect(narrow!.widthMm).toBeCloseTo(narrow!.clearXMm - 15, 5)
  })

  it('12 sections and ~498 lamellas — mid bay is one 1287 cell', () => {
    const sections = buildLamellaSections(houseMaxSpec(), profiles)
    const schedule = groupLamellaSectionTypes(sections)
    expect(sections.length).toBe(12)
    const total = sections.reduce((n, s) => n + countedLamellaRows(s), 0)
    expect(total).toBe(498)
    expect(schedule.totalSections).toBe(12)
    expect(schedule.totalLamellas).toBe(498)
    const mid = sections.find((s) => s.minX < 3000 && s.maxX > 3800 && s.maxY < 5000)
    expect(mid).toBeTruthy()
    expect(mid!.widthMm).toBeCloseTo(1287.1, 0)
    expect(mid!.lamellaCount).toBe(49)
  })

  it('column checksum: frame + 15+H+15 + shelf + 15+H+15 + frame ≈ vertical outer', () => {
    const spec = houseMaxSpec()
    const sections = buildLamellaSections(spec, profiles)
    const cols = columnHeightChecksums(sections, spec, profiles)
    expect(cols.length).toBeGreaterThanOrEqual(4)
    for (const col of cols) {
      expect(
        Math.abs(col.sumMm - col.measuredOuterMm),
        `${col.id} sum=${col.sumMm} outer=${col.measuredOuterMm} parts=${col.parts.map((p) => p.mm).join('+')}`,
      ).toBeLessThanOrEqual(2)
    }
  })

  it('sections do not overlap each other or leave centroids outside their box', () => {
    const sections = buildLamellaSections(houseMaxSpec(), profiles)
    for (let i = 0; i < sections.length; i++) {
      const a = sections[i]
      const acx = (a.minX + a.maxX) / 2
      const acy = (a.minY + a.maxY) / 2
      expect(acx).toBeGreaterThanOrEqual(a.minX - 0.5)
      expect(acx).toBeLessThanOrEqual(a.maxX + 0.5)
      expect(acy).toBeGreaterThanOrEqual(a.minY - 0.5)
      expect(acy).toBeLessThanOrEqual(a.maxY + 0.5)
      for (let j = i + 1; j < sections.length; j++) {
        const b = sections[j]
        const overlapX = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)
        const overlapY = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY)
        expect(overlapX <= 1 || overlapY <= 1).toBe(true)
      }
    }
    expect(sections.length).toBe(12)
  })
})

describe('collinear limiter bay merge', () => {
  it('tolerance is 20 mm (tilt ~14 merges; real 60 mm step does not)', () => {
    expect(COLLINEAR_LIMITER_STEP_TOLERANCE_MM).toBe(20)
  })

  it('merges a 14 mm shelf/notch step and keeps the smaller clear', () => {
    const left = { minX: 2754, maxX: 3245, minY: 70, maxY: 4563.4 }
    const right = { minX: 3245, maxX: 4056, minY: 70, maxY: 4577 }
    const out = mergeSteppedBays([left, right], true)
    expect(out).toHaveLength(1)
    expect(out[0].minX).toBe(2754)
    expect(out[0].maxX).toBe(4056)
    expect(out[0].minY).toBe(70)
    expect(out[0].maxY).toBeCloseTo(4563.4, 5)
  })

  it('keeps a 60 mm real step as two sections', () => {
    const left = { minX: 0, maxX: 1000, minY: 0, maxY: 4000 }
    const right = { minX: 1000, maxX: 2000, minY: 0, maxY: 4060 }
    const out = mergeSteppedBays([left, right], true)
    expect(out).toHaveLength(2)
  })
})
