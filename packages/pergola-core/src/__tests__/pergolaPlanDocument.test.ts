import { describe, expect, it } from 'vitest'
import {
  SUPPORT_BEAMS_FORMAT_VERSION,
  mergePergolaPlanDocument,
  pickPergolaPlanExtras,
  serializePergolaPlan,
  type SupportBeamsDocument,
} from '../index'
import { DEFAULT_PLAN_CONSTRUCTION_PARAMS } from '../planDefaults'

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

const POLYGON = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 6000 },
  { x: 0, y: 6000 },
]

describe('pergolaPlanDocument round-trip', () => {
  it('pickPergolaPlanExtras keeps unknown top-level keys and skips known ones', () => {
    const extras = pickPergolaPlanExtras({
      schemaVersion: 1,
      polygon: POLYGON,
      wallIndices: [],
      params: DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      confirmed: false,
      supportBeams: BEAMS,
      futureField: { a: 1 },
      notes: 'keep me',
    })
    expect(extras).toEqual({ futureField: { a: 1 }, notes: 'keep me' })
    expect(extras).not.toHaveProperty('supportBeams')
    expect(extras).not.toHaveProperty('polygon')
  })

  it('merge keeps previous supportBeams when the patch omits them (params-only save)', () => {
    const next = mergePergolaPlanDocument({
      extras: { notes: 'x' },
      polygon: POLYGON,
      wallIndices: [0],
      params: { ...DEFAULT_PLAN_CONSTRUCTION_PARAMS, lamellaGapMm: 25 },
      confirmed: false,
      prevSupportBeams: BEAMS,
    })
    expect(next.supportBeams).toEqual(BEAMS)
    expect(next.notes).toBe('x')
    expect((next.params as { lamellaGapMm: number }).lamellaGapMm).toBe(25)
  })

  it('merge replaces supportBeams when explicitly patched; null clears', () => {
    const replaced = mergePergolaPlanDocument({
      polygon: POLYGON,
      wallIndices: [],
      params: DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      supportBeams: { ...BEAMS, beams: [] },
      prevSupportBeams: BEAMS,
    })
    expect(replaced.supportBeams).toEqual({ ...BEAMS, beams: [] })

    const cleared = mergePergolaPlanDocument({
      polygon: POLYGON,
      wallIndices: [],
      params: DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      supportBeams: null,
      prevSupportBeams: BEAMS,
    })
    expect(cleared).not.toHaveProperty('supportBeams')
  })

  it('serialize keeps beams and extras', () => {
    const doc = serializePergolaPlan(
      {
        schemaVersion: 1,
        polygon: POLYGON,
        wallIndices: [],
        params: DEFAULT_PLAN_CONSTRUCTION_PARAMS,
        confirmed: true,
        supportBeams: BEAMS,
      },
      { custom: 42 },
    )
    expect(doc.supportBeams).toEqual(BEAMS)
    expect(doc.custom).toBe(42)
  })
})
