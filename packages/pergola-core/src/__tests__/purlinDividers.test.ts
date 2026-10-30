import { describe, expect, it } from 'vitest'
import { computePurlinClearGapsMm } from '../topPlanDimensions'
import { buildBom } from '../bom/buildBom'
import { ACCEPTANCE_MODEL } from '../bom/__tests__/fixture'
import { buildPieces } from '../buildPieces'
import { removePlanDivider, resolvePlanPurlinLines } from '../dividerEdits'
import {
  buildDividerPickPieces,
  diagnoseDividerPicking,
  uniqueDividerIdsWithPickZones,
} from '../dividerPickPieces'
import { DEFAULT_PLAN_CONSTRUCTION_PARAMS } from '../planDefaults'
import { computeLamellas } from '../lamellas'
import {
  computeMaxEqualPurlinClearGapMm,
  dividerPositionsForMaxEqualClears,
  resolvePurlinPositionsMm,
} from '../lamellaSpans'
import { packProfile } from '../packProfile'
import { computePurlins } from '../purlins'
import type { PergolaSpec, ProfileDimensions } from '../types'

const PROFILES: Map<string, ProfileDimensions> = new Map([
  ['beam-1', { widthMm: 40, heightMm: 100, availableStockLengthsMm: [8000] }],
  ['f10040', { widthMm: 40, heightMm: 100, availableStockLengthsMm: [8000] }],
  ['post-1', { widthMm: 80, heightMm: 80 }],
  ['f8080', { widthMm: 80, heightMm: 80 }],
  ['lam-1', { widthMm: 70, heightMm: 20, maxLamellaSpanMm: 1500 }],
  ['f7020', { widthMm: 70, heightMm: 20, maxLamellaSpanMm: 1500 }],
  ['purlin-1', { widthMm: 30, heightMm: 50, interruptsLamella: true, availableStockLengthsMm: [8000] }],
  ['purlin-led-6040', { widthMm: 30, heightMm: 50, interruptsLamella: true, availableStockLengthsMm: [8000] }],
  // DEFAULT_PLAN_CONSTRUCTION_PARAMS.purlinProfileId is PA3022 since the default
  // moved off purlin-led-6040. Pick zones are empty without this entry.
  ['PA3022', { widthMm: 40, heightMm: 120, interruptsLamella: true, availableStockLengthsMm: [8000] }],
])

function spec(overrides: Partial<PergolaSpec> = {}): PergolaSpec {
  return {
    contour: [[0, 0], [6000, 0], [6000, 3000], [0, 3000]],
    heightMm: 2600,
    lamellaGapMm: 30,
    lamellaAngleDeg: 0,
    lamellaDirectionDeg: 0,
    postProfileId: 'post-1',
    beamProfileId: 'beam-1',
    lamellaProfileId: 'lam-1',
    purlinProfileId: 'purlin-1',
    color: '#FFFFFF',
    ...overrides,
  }
}

describe('resolvePurlinPositionsMm', () => {
  it('auto mode uses Max equal-clear placement, not even-axis steps', () => {
    const auto = resolvePurlinPositionsMm({
      rangeMinMm: 0,
      rangeMaxMm: 6000,
      maxSpanMm: 1500,
      endBeamPlanWidthMm: 40,
    })
    // ceil(6000/1500)=4 would put the end cut at 1510 > 1500, so one extra span.
    const expected = dividerPositionsForMaxEqualClears({
      rangeMinMm: 0,
      rangeMaxMm: 6000,
      outerLengthMm: 6000,
      endBeamPlanWidthMm: 40,
      dividerCount: 4,
    })
    expect(auto.map((l) => l.positionMm)).toEqual(expected.map((l) => l.positionMm))
    expect(auto.map((l) => l.id)).toEqual(['div-1', 'div-2', 'div-3', 'div-4'])
    expect(auto.map((l) => Math.round(l.positionMm))).toEqual([1212, 2404, 3596, 4788])
  })

  it('Midot 8000 / 5 dividers: all 6 clears equal (8000 − 80 − 200) / 6', () => {
    const auto = resolvePurlinPositionsMm({
      rangeMinMm: 0,
      rangeMaxMm: 8000,
      maxSpanMm: 1500,
      endBeamPlanWidthMm: 40,
    })
    expect(auto).toHaveLength(5)
    const expectedClear = computeMaxEqualPurlinClearGapMm(8000, 40, 5)
    expect(expectedClear).toBeCloseTo(7720 / 6, 6)
    const gaps = computePurlinClearGapsMm({
      rangeMinMm: 0,
      rangeMaxMm: 8000,
      beamWidthMm: 40,
      dividerWidthMm: 40,
      dividerPositions: auto,
    })
    expect(gaps).toHaveLength(6)
    for (const gap of gaps) expect(gap).toBeCloseTo(expectedClear, 6)
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(0.001)
  })

  it('manual mode uses persisted lines, not the even-span grid', () => {
    const manual = resolvePurlinPositionsMm({
      rangeMinMm: 0,
      rangeMaxMm: 6000,
      maxSpanMm: 1500,
      mode: 'manual',
      lines: [
        { id: 'keep', positionMm: 2000 },
        { id: 'edge', positionMm: 0 },
        { id: 'keep', positionMm: 4000 },
      ],
    })
    expect(manual).toEqual([{ id: 'keep', positionMm: 2000 }])
  })
})

describe('computePurlins + computeLamellas share resolvePurlinPositionsMm', () => {
  it('one dividerId on every clipped segment of the same crossing line', () => {
    const contour: PergolaSpec['contour'] = [
      [0, 0], [9000, 0], [9000, 3000], [6000, 3000], [6000, 1000], [3000, 1000], [3000, 3000], [0, 3000],
    ]
    const s = spec({
      contour,
      lamellaDirectionDeg: 90,
      purlinDividers: { mode: 'manual', lines: [{ id: 'split-line', positionMm: 2000 }] },
    })
    const purlins = computePurlins(s, PROFILES)
    expect(purlins.length).toBeGreaterThanOrEqual(2)
    expect(purlins.every((p) => p.role === 'purlin' && p.dividerId === 'split-line')).toBe(true)

    const lamellas = computeLamellas(s, PROFILES)
    const crossings = resolvePurlinPositionsMm({
      rangeMinMm: 0,
      rangeMaxMm: 3000,
      maxSpanMm: 1500,
      mode: 'manual',
      lines: [{ id: 'split-line', positionMm: 2000 }],
    })
    expect(crossings).toEqual([{ id: 'split-line', positionMm: 2000 }])
    expect(lamellas.some((p) => p.lengthAxisMm < 2000)).toBe(true)
  })
})

describe('delete divider recalculates lamellas / nest / BOM warnings', () => {
  const lines = [
    { id: 'a', positionMm: 1500 },
    { id: 'b', positionMm: 3000 },
    { id: 'c', positionMm: 4500 },
  ]

  it('removing a divider lengthens lamellas and changes the cut nest; BOM carries warnings', () => {
    const beforeSpec = spec({ purlinDividers: { mode: 'manual', lines } })
    const before = buildPieces(beforeSpec, PROFILES)
    expect(before.warnings).toEqual([])

    const afterParams = removePlanDivider(
      beforeSpec.contour,
      {
        ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
        lamellaGapMm: 30,
        beamProfileId: 'beam-1',
        purlinProfileId: 'purlin-1',
        postProfileId: 'post-1',
        colorHex: '#FFFFFF',
        purlinDividers: { mode: 'manual', lines },
      },
      PROFILES,
      'b',
    )
    expect(afterParams.purlinDividers.mode).toBe('manual')
    expect(afterParams.purlinDividers.lines?.map((l) => l.id)).toEqual(['a', 'c'])

    const after = buildPieces(spec({ purlinDividers: afterParams.purlinDividers }), PROFILES)
    const beforeLam = before.pieces.filter((p) => p.role === 'lamella')
    const afterLam = after.pieces.filter((p) => p.role === 'lamella')
    expect(afterLam.length).toBeLessThan(beforeLam.length)
    expect(Math.max(...afterLam.map((p) => p.lengthAxisMm))).toBeGreaterThan(
      Math.max(...beforeLam.map((p) => p.lengthAxisMm)),
    )

    const beforeNest = packProfile(beforeLam, 6000, 4)
    const afterNest = packProfile(afterLam, 6000, 4)
    expect(afterNest.totalBars !== beforeNest.totalBars || afterNest.totalWasteMm !== beforeNest.totalWasteMm).toBe(true)

    const bom = buildBom(ACCEPTANCE_MODEL, undefined, undefined, undefined, { warnings: after.warnings })
    expect(bom.warnings).toEqual(after.warnings)
    expect(bom.parts.filter((p) => p.kind === 'division')).toHaveLength(3)
    expect(bom.parts.filter((p) => p.kind === 'division').every((d) => d.lengthCm === 392)).toBe(true)
  })
})

describe('LED reversal vs structural dividers', () => {
  it('keeps structuralPurlins with dividerId when LED stock rewrite drops visual ids', () => {
    const profiles = new Map(PROFILES)
    profiles.set('led-short', {
      widthMm: 60,
      heightMm: 40,
      interruptsLamella: true,
      hasLedChannel: true,
      availableStockLengthsMm: [2500],
      maxLedStepMm: 800,
    })
    const s = spec({
      contour: [
        [0, 0], [2000, 0], [2000, 3500], [5000, 3500],
        [5000, 0], [7000, 0], [7000, 5500], [0, 5500],
      ],
      lamellaDirectionDeg: 90,
      purlinProfileId: 'led-short',
    })
    const built = buildPieces(s, profiles)
    expect(built.structuralPurlins.length).toBeGreaterThan(0)
    expect(built.structuralPurlins.every((p) => typeof p.dividerId === 'string' && p.dividerId.length > 0)).toBe(true)
    const visual = built.pieces.filter((p) => p.role === 'purlin')
    expect(visual.length).toBeGreaterThan(0)
    expect(visual.every((p) => typeof p.dividerId === 'string' && p.dividerId.length > 0)).toBe(true)
  })
})

const U_CONTOUR: PergolaSpec['contour'] = [
  [0, 0], [2000, 0], [2000, 3500], [5000, 3500],
  [5000, 0], [7000, 0], [7000, 5500], [0, 5500],
]

describe('divider 3D pick zones', () => {
  function planParams(overrides: Partial<typeof DEFAULT_PLAN_CONSTRUCTION_PARAMS> = {}) {
    return {
      ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      lamellaGapMm: 30,
      lamellaDirectionDeg: 90,
      colorHex: '#FFFFFF',
      ...overrides,
    }
  }

  it('every resolved dividerId has pick zone(s); U auto may have multiple zones per line', () => {
    const contour = U_CONTOUR
    const params = planParams({ purlinDividers: { mode: 'auto' } })
    const lines = resolvePlanPurlinLines(contour, params, PROFILES)
    const picks = buildDividerPickPieces(contour, params, PROFILES)
    expect(uniqueDividerIdsWithPickZones(picks).size).toBe(lines.length)
    expect(lines.map((l) => l.id).every((id) => uniqueDividerIdsWithPickZones(picks).has(id))).toBe(true)
    expect(picks.length).toBeGreaterThanOrEqual(lines.length)
    expect(diagnoseDividerPicking({
      contour,
      params,
      profiles: PROFILES,
      structuralPurlins: computePurlins(spec({ contour, lamellaDirectionDeg: 90 }), PROFILES),
      visualPurlins: [],
    }).every((d) => d.hasHighlightZone && d.pickZoneCount >= 1)).toBe(true)
  })

  it('notch crossing gets one pick zone per clipped wing (manual split-line)', () => {
    const contour: PergolaSpec['contour'] = [
      [0, 0], [9000, 0], [9000, 3000], [6000, 3000], [6000, 1000], [3000, 1000], [3000, 3000], [0, 3000],
    ]
    const params = planParams({
      lamellaDirectionDeg: 90,
      purlinDividers: { mode: 'manual', lines: [{ id: 'split-line', positionMm: 2000 }] },
    })
    const picks = buildDividerPickPieces(contour, params, PROFILES)
    const forLine = picks.filter((p) => p.dividerId === 'split-line')
    expect(forLine.length).toBeGreaterThanOrEqual(2)
  })

  it('every manual line on U fixture has pick zones', () => {
    const contour = U_CONTOUR
    const lines = [
      { id: 'm1', positionMm: 1200 },
      { id: 'm2', positionMm: 3500 },
      { id: 'm-edge', positionMm: 0 },
    ]
    const params = planParams({ purlinDividers: { mode: 'manual', lines } })
    const resolved = resolvePlanPurlinLines(contour, params, PROFILES)
    const picks = buildDividerPickPieces(contour, params, PROFILES)
    expect(uniqueDividerIdsWithPickZones(picks).size).toBe(resolved.length)
    expect(diagnoseDividerPicking({
      contour,
      params,
      profiles: PROFILES,
      structuralPurlins: [],
      visualPurlins: [],
    }).filter((d) => !d.hasHighlightZone)).toEqual([])
  })
})

describe('buildPieces span policy', () => {
  it('mode auto still throws when a lamella exceeds maxLamellaSpanMm', () => {
    const s = spec({ purlinProfileId: undefined, purlinDividers: { mode: 'auto' } })
    expect(() => buildPieces(s, PROFILES)).toThrow(/maxLamellaSpanMm/)
    try {
      buildPieces(s, PROFILES)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      const details = message.split('\n').filter((line) => line.includes('profile "'))
      expect(details.length).toBeGreaterThan(1)
      expect(new Set(details).size).toBe(details.length)
      expect(details[0]).toMatch(/\[lamella-\d+\]/)
    }
  })

  it('mode manual converts the same span exceed into warnings[] and still returns pieces', () => {
    const s = spec({
      purlinDividers: { mode: 'manual', lines: [{ id: 'only', positionMm: 500 }] },
    })
    const built = buildPieces(s, PROFILES)
    expect(built.pieces.length).toBeGreaterThan(0)
    expect(built.warnings.length).toBeGreaterThan(0)
    expect(built.warnings.every((w) => w.type === 'lamella-span-exceeds-max')).toBe(true)
    expect(built.warnings.some((w) => w.startDividerId === 'only' || w.endDividerId === 'only')).toBe(true)
    expect(built.warnings.every((w) => w.spanEndMm > w.spanStartMm)).toBe(true)
  })
})
