import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_PLAN_CONSTRUCTION_PARAMS } from '@pashkovsky/pergola-core'
import {
  planContourSvgLegacy,
  planTopSheetSvg,
} from '@/lib/pdf/polygon-plan-drawing.server'

/** Same vertices as `G_SLOPE_FIXTURE` in pergola-core tests. */
const G_POLYGON = [
  { x: 0, y: 0 },
  { x: 0, y: 9996 },
  { x: 13002, y: 9996 },
  { x: 13002, y: 4622 },
]

const PARAMS = {
  ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  lamellaDirectionDeg: 0,
}

const OUT_DIR = join(process.cwd(), '.screenshots')

describe('G-shape PDF plan snapshots', () => {
  it('writes legacy axis vs TopPlanSheet-aligned SVG for comparison', () => {
    mkdirSync(OUT_DIR, { recursive: true })
    const before = planContourSvgLegacy(G_POLYGON)
    const after = planTopSheetSvg(G_POLYGON, [], PARAMS)
    writeFileSync(join(OUT_DIR, 'pdf-g-shape-dimensions-before-legacy.svg'), before)
    writeFileSync(join(OUT_DIR, 'pdf-g-shape-dimensions-after-topplan.svg'), after)
    expect(before).toContain('legacy-axis')
    expect(after).toContain('data-plan-contour="1"')
    expect(after).not.toContain('legacy-axis')
    expect(after).toContain('°')
    const legacyLabelCount = (before.match(/fill="#111827"/g) ?? []).length
    const afterDimTexts = (after.match(/font-size="220"/g) ?? []).length
    expect(legacyLabelCount).toBe(4)
    expect(afterDimTexts).toBeGreaterThan(4)
  })

  it('L 12000 / 8×40 / frame 40 → 9×1288.9; 6000 double-T → 5×1140.0', () => {
    mkdirSync(OUT_DIR, { recursive: true })
    const L = [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 3000 },
      { x: 11960, y: 3000 },
      { x: 11960, y: 6460 },
      { x: 0, y: 6460 },
    ]
    const lSvg = planTopSheetSvg(L, [], {
      ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      beamProfileId: 'f10040',
      measuredOuterLengthMmByEdgeIndex: [4000, 3000, 8000, 3500, 12000, 6500],
      purlinClearLayoutVersion: 1,
    })
    writeFileSync(join(OUT_DIR, 'pdf-l-shape-12000-clears-1288.9.svg'), lSvg)
    expect(lSvg).toContain('9×1288.9')
    expect(lSvg).not.toContain('9×1284')
    expect(lSvg).not.toContain('9×1278')

    const rect = [
      { x: 0, y: 0 },
      { x: 6000, y: 0 },
      { x: 6000, y: 3000 },
      { x: 0, y: 3000 },
    ]
    const rSvg = planTopSheetSvg(rect, [], {
      ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      beamProfileId: 'R242',
      measuredOuterLengthMmByEdgeIndex: [6000, 3000, 6000, 3000],
      purlinClearLayoutVersion: 1,
    })
    writeFileSync(join(OUT_DIR, 'pdf-rect-6000-double-t-1140.svg'), rSvg)
    expect(rSvg).toContain('5×1140.0')
  })
})
