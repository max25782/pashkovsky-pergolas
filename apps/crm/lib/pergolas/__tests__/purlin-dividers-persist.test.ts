import { DEFAULT_PLAN_CONSTRUCTION_PARAMS, PERGOLA_PLAN_SCHEMA_VERSION } from '@pashkovsky/pergola-core'
import { parsePergolaPlan } from '@/lib/pergolas/normalize-pergola'
import { validatePergolaPlanForApi } from '@/lib/pergolas/validate-pergola-plan'

const polygon = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 3000 },
  { x: 0, y: 3000 },
]

describe('purlinDividers persist / parseParams round-trip', () => {
  it('missing field defaults to auto', () => {
    const plan = parsePergolaPlan({
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon,
      wallIndices: [],
      params: { lamellaPatternId: 'all-70' },
      confirmed: true,
    })
    expect(plan?.params.purlinDividers).toEqual(DEFAULT_PLAN_CONSTRUCTION_PARAMS.purlinDividers)
    expect(plan?.params.purlinDividers.mode).toBe('auto')
  })

  it('manual lines survive parse → JSON → parse', () => {
    const saved = {
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon,
      wallIndices: [],
      params: {
        purlinDividers: {
          mode: 'manual' as const,
          lines: [
            { id: 'a', positionMm: 1200 },
            { id: 'b', positionMm: 2400 },
          ],
        },
      },
      confirmed: true,
    }
    const plan = parsePergolaPlan(saved)
    expect(plan?.params.purlinDividers).toEqual({
      mode: 'manual',
      lines: [
        { id: 'a', positionMm: 1200 },
        { id: 'b', positionMm: 2400 },
      ],
    })
    const again = parsePergolaPlan(JSON.parse(JSON.stringify(plan)))
    expect(again?.params.purlinDividers).toEqual(plan?.params.purlinDividers)
  })

  it('saved plan without postMaxSpanMm stays on the legacy (unset) rule', () => {
    const plan = parsePergolaPlan({
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon,
      wallIndices: [],
      params: { beamProfileId: 'f10040' },
      confirmed: true,
    })
    expect(plan?.params.postMaxSpanMm).toBeUndefined()
  })

  it('new API plan without an explicit postMaxSpanMm gets 4000', () => {
    const result = validatePergolaPlanForApi({
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon,
      wallIndices: [],
      params: {},
      confirmed: true,
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.plan.params.postMaxSpanMm).toBe(4000)
  })

  it('accepts manual dividers through the API schema', () => {
    const result = validatePergolaPlanForApi({
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon,
      wallIndices: [],
      params: {
        purlinDividers: { mode: 'manual', lines: [{ id: 'x', positionMm: 800 }] },
      },
      confirmed: true,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plan.params.purlinDividers).toEqual({
        mode: 'manual',
        lines: [{ id: 'x', positionMm: 800 }],
      })
    }
  })

  it('measuredOuterLengthMmByEdgeIndex survives parse → JSON → parse', () => {
    const measured = [4000, 3000, 8000, 6000, 4000, 3000]
    const midot = [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 3000 },
      { x: -4000, y: 3000 },
      { x: -4000, y: -3000 },
      { x: 0, y: -3000 },
    ]
    const plan = parsePergolaPlan({
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon: midot,
      wallIndices: [],
      params: { measuredOuterLengthMmByEdgeIndex: measured },
      confirmed: true,
    })
    expect(plan?.params.measuredOuterLengthMmByEdgeIndex).toEqual(measured)
    const again = parsePergolaPlan(JSON.parse(JSON.stringify(plan)))
    expect(again?.params.measuredOuterLengthMmByEdgeIndex).toEqual(measured)
    const result = validatePergolaPlanForApi({
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon: midot,
      wallIndices: [],
      params: { measuredOuterLengthMmByEdgeIndex: measured },
      confirmed: true,
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.plan.params.measuredOuterLengthMmByEdgeIndex).toEqual(measured)
  })

  it('saved plan without purlinClearLayoutVersion stays legacy (unset)', () => {
    const plan = parsePergolaPlan({
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon,
      wallIndices: [],
      params: { beamProfileId: 'f10040' },
      confirmed: true,
    })
    expect(plan?.params.purlinClearLayoutVersion).toBeUndefined()
  })

  it('purlinClearLayoutVersion 1 survives parse → JSON → parse', () => {
    const plan = parsePergolaPlan({
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon,
      wallIndices: [],
      params: { purlinClearLayoutVersion: 1 },
      confirmed: true,
    })
    expect(plan?.params.purlinClearLayoutVersion).toBe(1)
    const again = parsePergolaPlan(JSON.parse(JSON.stringify(plan)))
    expect(again?.params.purlinClearLayoutVersion).toBe(1)
    const result = validatePergolaPlanForApi({
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon,
      wallIndices: [],
      params: { purlinClearLayoutVersion: 1 },
      confirmed: true,
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.plan.params.purlinClearLayoutVersion).toBe(1)
  })

  it('saved plan without lamellaSectionLayoutVersion stays legacy (unset)', () => {
    const plan = parsePergolaPlan({
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon,
      wallIndices: [],
      params: { beamProfileId: 'f10040' },
      confirmed: true,
    })
    expect(plan?.params.lamellaSectionLayoutVersion).toBeUndefined()
  })

  it('lamellaSectionLayoutVersion 1 survives parse → JSON → parse', () => {
    const plan = parsePergolaPlan({
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon,
      wallIndices: [],
      params: { lamellaSectionLayoutVersion: 1 },
      confirmed: true,
    })
    expect(plan?.params.lamellaSectionLayoutVersion).toBe(1)
    const again = parsePergolaPlan(JSON.parse(JSON.stringify(plan)))
    expect(again?.params.lamellaSectionLayoutVersion).toBe(1)
    const result = validatePergolaPlanForApi({
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon,
      wallIndices: [],
      params: {},
      confirmed: true,
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.plan.params.lamellaSectionLayoutVersion).toBe(1)
  })

  it('saved plan without skewSectionVersion stays one rectangle width', () => {
    const plan = parsePergolaPlan({
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon,
      wallIndices: [],
      params: { beamProfileId: 'f10040' },
      confirmed: true,
    })
    expect(plan?.params.skewSectionVersion).toBeUndefined()
    expect(plan?.params.lamellaLengthStepMm).toBeUndefined()
    const result = validatePergolaPlanForApi({
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon,
      wallIndices: [],
      params: {},
      confirmed: true,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plan.params.skewSectionVersion).toBeUndefined()
      expect(result.plan.params.lamellaLengthStepMm).toBeUndefined()
    }
  })

  it('skewSectionVersion 1 survives parse → JSON → parse', () => {
    const plan = parsePergolaPlan({
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon,
      wallIndices: [],
      params: { skewSectionVersion: 1, lamellaLengthStepMm: 1 },
      confirmed: true,
    })
    expect(plan?.params.skewSectionVersion).toBe(1)
    expect(plan?.params.lamellaLengthStepMm).toBe(1)
    const again = parsePergolaPlan(JSON.parse(JSON.stringify(plan)))
    expect(again?.params.skewSectionVersion).toBe(1)
    expect(again?.params.lamellaLengthStepMm).toBe(1)
  })

  it('saved plan without purlinMaxSpanMm stays legacy (unset)', () => {
    const plan = parsePergolaPlan({
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon,
      wallIndices: [],
      params: { beamProfileId: 'f10040' },
      confirmed: true,
    })
    expect(plan?.params.purlinMaxSpanMm).toBeUndefined()
    const result = validatePergolaPlanForApi({
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon,
      wallIndices: [],
      params: { beamProfileId: 'f10040' },
      confirmed: true,
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.plan.params.purlinMaxSpanMm).toBeUndefined()
  })

  it('purlinMaxSpanMm 4000 survives parse → JSON → parse', () => {
    const plan = parsePergolaPlan({
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon,
      wallIndices: [],
      params: { purlinMaxSpanMm: 4000, wingShelfProfileId: 'purlin-plain-5030' },
      confirmed: true,
    })
    expect(plan?.params.purlinMaxSpanMm).toBe(4000)
    expect(plan?.params.wingShelfProfileId).toBe('purlin-plain-5030')
    const again = parsePergolaPlan(JSON.parse(JSON.stringify(plan)))
    expect(again?.params.purlinMaxSpanMm).toBe(4000)
  })

  it('saved plan without wallBeamWidthVersion stays legacy (unset)', () => {
    const plan = parsePergolaPlan({
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon,
      wallIndices: [0],
      params: { beamProfileId: 'pa1429' },
      confirmed: true,
    })
    expect(plan?.params.wallBeamWidthVersion).toBeUndefined()
    expect(plan?.params.wallProfileId).toBeUndefined()
  })

  it('wallBeamWidthVersion 1 survives parse → JSON → parse and new API plans get it', () => {
    const plan = parsePergolaPlan({
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon,
      wallIndices: [0],
      params: { wallBeamWidthVersion: 1, wallProfileId: 'pa1162' },
      confirmed: true,
    })
    expect(plan?.params.wallBeamWidthVersion).toBe(1)
    expect(plan?.params.wallProfileId).toBe('pa1162')
    const again = parsePergolaPlan(JSON.parse(JSON.stringify(plan)))
    expect(again?.params.wallBeamWidthVersion).toBe(1)
    expect(again?.params.wallProfileId).toBe('pa1162')
    const result = validatePergolaPlanForApi({
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon,
      wallIndices: [],
      params: {},
      confirmed: true,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plan.params.wallBeamWidthVersion).toBe(1)
      expect(result.plan.params.wallProfileId).toBe('f10040')
    }
  })
})
