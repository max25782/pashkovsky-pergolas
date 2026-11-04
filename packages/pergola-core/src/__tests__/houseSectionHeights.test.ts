/**
 * House outer-faces: section H = face-to-face clear − 15 − 15.
 * Shelf / notch wall (40) lies entirely inside from the contour (down into the field).
 * Top frame is free 70 on G–H and wall 40 on C–D.
 */
import { describe, expect, it } from 'vitest'
import {
  HOUSE_CONTOUR_MM,
  HOUSE_WALL_EDGE_INDICES,
  houseConstructionParams,
} from '../acceptance/houseContour'
import {
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  PERGOLA_CONSTRUCTION_PROFILES,
  buildLamellaSections,
  columnHeightChecksums,
  countedLamellaRows,
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
    const underNotch = rows.filter(
      (r) => r.maxY < 5000 && (r.minX + r.maxX) / 2 > 3300 && (r.minX + r.maxX) / 2 < 6700,
    )

    expect(upperLeft.length).toBeGreaterThanOrEqual(2)
    expect(upperRight.length).toBe(2)
    expect(lowerLeft.length).toBeGreaterThanOrEqual(2)
    expect(lowerRight.length).toBe(2)
    expect(underNotch.length).toBeGreaterThanOrEqual(1)

    // 2871 − 70 − 30 = 2771 (tilt of EF ≤ ~6 mm)
    for (const r of upperLeft) expect(r.heightMm).toBeGreaterThan(2765)
    for (const r of upperLeft) expect(r.heightMm).toBeLessThan(2777)
    // 2865 − 40 − 30 = 2795
    for (const r of upperRight) expect(r.heightMm).toBeGreaterThan(2785)
    for (const r of upperRight) expect(r.heightMm).toBeLessThan(2800)
    // 7480 − 2871 − 40 − 70 − 30 = 4469
    for (const r of lowerLeft) expect(r.heightMm).toBeGreaterThan(4455)
    for (const r of lowerLeft) expect(r.heightMm).toBeLessThan(4475)
    // 7480 − 2865 − 40 − 70 − 30 = 4475
    for (const r of lowerRight) expect(r.heightMm).toBeGreaterThan(4470)
    for (const r of lowerRight) expect(r.heightMm).toBeLessThan(4480)
    // Under notch ≈ 4469–4475
    for (const r of underNotch) expect(r.heightMm).toBeGreaterThan(4465)
    for (const r of underNotch) expect(r.heightMm).toBeLessThan(4485)

    // Narrow F: clear ≈ 486 → width ≈ 471 (allow small snap)
    const narrow = rows.find((r) => r.widthMm < 600 && r.maxY > 7000)
    expect(narrow).toBeTruthy()
    expect(narrow!.clearXMm).toBeGreaterThan(480)
    expect(narrow!.clearXMm).toBeLessThan(495)
    expect(narrow!.widthMm).toBeCloseTo(narrow!.clearXMm - 15, 5)
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
    const total = sections.reduce((n, s) => n + countedLamellaRows(s), 0)
    expect(total).toBeGreaterThan(480)
    expect(total).toBeLessThan(560)
    expect(sections.length).toBeGreaterThanOrEqual(12)
    expect(sections.length).toBeLessThanOrEqual(14)
  })
})
