import { PERGOLA_PLAN_SCHEMA_VERSION, parseLamellaZones, type LamellaZone } from '@pashkovsky/pergola-core'
import { parsePergolaPlan } from '@/lib/pergolas/normalize-pergola'
import { validatePergolaPlanForApi } from '@/lib/pergolas/validate-pergola-plan'

const polygon = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 3000 },
  { x: 0, y: 3000 },
]

const zones: LamellaZone[] = [
  { id: 'wing', cutEdgeIndex: 2, lamellaEdgeIndex: 2, dividerEdgeIndex: 1 },
  { id: 'second', cutEdgeIndex: 0, lamellaEdgeIndex: 3, dividerEdgeIndex: 0 },
]

const saved = {
  schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
  polygon,
  wallIndices: [],
  params: { lamellaDirectionDeg: 90, lamellaZones: zones },
  confirmed: true as const,
}

describe('lamellaZones persist round-trip', () => {
  it('survives parse -> JSON -> parse unchanged', () => {
    const plan = parsePergolaPlan(saved)
    expect(plan?.params.lamellaZones).toEqual(zones)
    const again = parsePergolaPlan(JSON.parse(JSON.stringify(plan)))
    expect(again?.params.lamellaZones).toEqual(zones)
    expect(again).toEqual(plan)
  })

  it('survives the API validation path (the schema must not strip it)', () => {
    const result = validatePergolaPlanForApi(saved)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.plan.params.lamellaZones).toEqual(zones)
  })

  it('a plan without zones gets no lamellaZones key', () => {
    const plan = parsePergolaPlan({ ...saved, params: { lamellaDirectionDeg: 90 } })
    expect(plan?.params).not.toHaveProperty('lamellaZones')
    const result = validatePergolaPlanForApi({ ...saved, params: { lamellaDirectionDeg: 90 } })
    expect(result.ok && 'lamellaZones' in result.plan.params).toBe(false)
  })

  it('rejects a malformed zone at the API and skips it when reading a stored plan', () => {
    const broken = { id: 'bad', cutEdgeIndex: -1, lamellaEdgeIndex: 1, dividerEdgeIndex: 1 }
    expect(validatePergolaPlanForApi({ ...saved, params: { lamellaZones: [broken] } }).ok).toBe(false)
    expect(parseLamellaZones([broken, zones[0], { ...zones[0] }, 'x', null])).toEqual([zones[0]])
    expect(parseLamellaZones([broken])).toBeUndefined()
    expect(parseLamellaZones(undefined)).toBeUndefined()
  })

  it('overhangDividerVersion survives parse and the API path; absent stays absent', () => {
    const withVersion = { ...saved, params: { overhangDividerVersion: 1 as const } }
    expect(parsePergolaPlan(withVersion)?.params.overhangDividerVersion).toBe(1)
    const api = validatePergolaPlanForApi(withVersion)
    expect(api.ok && api.plan.params.overhangDividerVersion).toBe(1)
    const without = parsePergolaPlan({ ...saved, params: { lamellaDirectionDeg: 90 } })
    expect(without?.params.overhangDividerVersion).toBeUndefined()
  })
})
