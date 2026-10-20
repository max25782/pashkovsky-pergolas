import { DEFAULT_PLAN_CONSTRUCTION_PARAMS, PERGOLA_PLAN_SCHEMA_VERSION } from '@pashkovsky/pergola-core'
import { parsePergolaPlan } from '@/lib/pergolas/normalize-pergola'
import { validatePergolaPlanForApi } from '@/lib/pergolas/validate-pergola-plan'

const polygon = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 3000 },
  { x: 0, y: 3000 },
]

describe('lamellaWallThicknessMm persist / parse', () => {
  it('missing field on a saved plan defaults to 0.8', () => {
    const plan = parsePergolaPlan({
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon,
      wallIndices: [],
      params: { lamellaPatternId: 'all-70' },
      confirmed: true,
    })
    expect(plan?.params.lamellaWallThicknessMm).toBe(0.8)
    expect(plan?.params.lamellaWallThicknessMm).toBe(
      DEFAULT_PLAN_CONSTRUCTION_PARAMS.lamellaWallThicknessMm,
    )
  })

  it('migrates saved 1.0 to supplier 1.6', () => {
    const plan = parsePergolaPlan({
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon,
      wallIndices: [],
      params: { lamellaPatternId: 'all-70', lamellaWallThicknessMm: 1 },
      confirmed: true,
    })
    expect(plan?.params.lamellaWallThicknessMm).toBe(1.6)
  })

  it('accepts 1.6 through the API schema', () => {
    const result = validatePergolaPlanForApi({
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon,
      wallIndices: [],
      params: { lamellaWallThicknessMm: 1.6 },
      confirmed: true,
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.plan.params.lamellaWallThicknessMm).toBe(1.6)
  })
})
