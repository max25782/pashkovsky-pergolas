import {
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  PERGOLA_PLAN_SCHEMA_VERSION,
  SUPPORT_BEAMS_FORMAT_VERSION,
  type SupportBeamsDocument,
} from '@pashkovsky/pergola-core'
import { applyPlanGeometry } from '@/lib/pergolas/apply-plan-geometry'
import { parsePergolaPlan } from '@/lib/pergolas/normalize-pergola'
import type { Pergola } from '@/types/offer'

const BEAMS: SupportBeamsDocument = {
  formatVersion: SUPPORT_BEAMS_FORMAT_VERSION,
  beams: [
    {
      id: 'beam-l5-to-de',
      kind: 'straight',
      anchorMm: { x: 3104.1, y: 6300 },
      directionDeg: 90,
      profileId: 'PA3022',
      widthMm: 40,
      start: { purlinId: 'row-5', face: 'high' },
      end: { kind: 'outer-contour' },
    },
  ],
}

const RECT = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 6000 },
  { x: 0, y: 6000 },
]

function pergolaWithBeams(): Pergola {
  return {
    plan: {
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon: RECT,
      wallIndices: [],
      params: DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      confirmed: true,
      supportBeams: BEAMS,
      futureNote: 'keep',
    } as Pergola['plan'] & { futureNote: string },
    shape: { type: 'rectangle', width: 4, length: 6 },
    pricePerSqm: 750,
    location: 'גינה',
    pergolaType: 'fixed',
  }
}

describe('supportBeams persist across plan save paths', () => {
  it('applyPlanGeometry: load plan with beam, change unrelated params, beam intact + extras kept', () => {
    const prev = pergolaWithBeams()
    const next = applyPlanGeometry(prev, {
      polygon: RECT,
      wallIndices: [],
      params: { ...DEFAULT_PLAN_CONSTRUCTION_PARAMS, lamellaGapMm: 22 },
      isClosed: true,
      isSimple: true,
      // supportBeams omitted — geometry/params-only save must not strip beams
    })
    expect(next.plan?.supportBeams).toEqual(BEAMS)
    expect((next.plan as { futureNote?: string } | null)?.futureNote).toBe('keep')
    expect(next.plan?.params.lamellaGapMm).toBe(22)
    expect(next.plan?.confirmed).toBe(true)
  })

  it('applyPlanGeometry: explicit null clears beams', () => {
    const next = applyPlanGeometry(pergolaWithBeams(), {
      polygon: RECT,
      wallIndices: [],
      params: DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      isClosed: true,
      isSimple: true,
      supportBeams: null,
    })
    expect(next.plan?.supportBeams).toBeUndefined()
  })

  it('applyPlanGeometry: polygon edit keeps beams, clears confirmed', () => {
    const next = applyPlanGeometry(pergolaWithBeams(), {
      polygon: [
        { x: 0, y: 0 },
        { x: 5000, y: 0 },
        { x: 5000, y: 6000 },
        { x: 0, y: 6000 },
      ],
      wallIndices: [],
      params: DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      isClosed: true,
      isSimple: true,
    })
    expect(next.plan?.supportBeams).toEqual(BEAMS)
    expect(next.plan?.confirmed).toBe(false)
  })

  it('parsePergolaPlan keeps raw invalid supportBeams (warnings path, not silent drop)', () => {
    const plan = parsePergolaPlan({
      schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
      polygon: RECT,
      wallIndices: [],
      params: DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      confirmed: true,
      supportBeams: { formatVersion: 99, beams: [{ id: 'x' }] },
      orphanKey: true,
    })
    expect(plan).not.toBeNull()
    expect(plan?.supportBeams).toEqual({ formatVersion: 99, beams: [{ id: 'x' }] })
    expect((plan as { orphanKey?: boolean } | null)?.orphanKey).toBe(true)
  })

  it('JSON round-trip of plan with beams survives parsePergolaPlan', () => {
    const plan = parsePergolaPlan(JSON.parse(JSON.stringify(pergolaWithBeams().plan)))
    expect(plan?.supportBeams).toEqual(BEAMS)
  })
})
