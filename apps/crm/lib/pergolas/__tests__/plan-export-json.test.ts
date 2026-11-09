import { DEFAULT_PLAN_CONSTRUCTION_PARAMS } from '@pashkovsky/pergola-core'
import { buildPlanExportDocument, buildPlanExportJson } from '@/lib/pergolas/plan-export-json'
import { parsePergolaPlan } from '@/lib/pergolas/normalize-pergola'

const polygon = [
  { x: 0, y: 0 },
  { x: 6000, y: 0 },
  { x: 6000, y: 4000 },
  { x: 0, y: 4000 },
]

describe('plan export JSON', () => {
  it('always lists lamellaDirectionDeg and lamellaZones, even when unset', () => {
    const doc = buildPlanExportDocument({
      polygon,
      wallIndices: [0],
      params: DEFAULT_PLAN_CONSTRUCTION_PARAMS,
    })
    const params = doc.params as Record<string, unknown>
    expect(params.lamellaDirectionDeg).toBe(0)
    expect(params.lamellaZones).toEqual([])
    expect(doc.wallIndices).toEqual([0])
    expect(doc).not.toHaveProperty('supportBeams')
  })

  it('carries zones, direction and support beams, and loads back unchanged', () => {
    const zones = [{ id: 'wing', cutEdgeIndex: 1, lamellaEdgeIndex: 1, dividerEdgeIndex: 0 }]
    const beams = { formatVersion: 1, beams: [] }
    const json = buildPlanExportJson({
      polygon,
      wallIndices: [0, 3],
      params: { ...DEFAULT_PLAN_CONSTRUCTION_PARAMS, lamellaDirectionDeg: 90, lamellaZones: zones },
      supportBeams: beams,
    })
    const doc = JSON.parse(json)
    expect(doc.supportBeams).toEqual(beams)
    const plan = parsePergolaPlan({ ...doc, confirmed: true })
    expect(plan?.params.lamellaZones).toEqual(zones)
    expect(plan?.params.lamellaDirectionDeg).toBe(90)
    expect(plan?.wallIndices).toEqual([0, 3])
  })
})
