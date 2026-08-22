import { describe, it, expect } from 'vitest'
import { applyVisturBeamSegmentReductionMm, applyVisturLengthReductionMm, DEFAULT_VISTUR_TOLERANCES } from '../visturTolerances'
import type { VisturTolerances } from '../visturTolerances'

describe('applyVisturBeamSegmentReductionMm', () => {
  it('проём 1300 → сегмент балки 1285 (default tolerances)', () => {
    expect(applyVisturBeamSegmentReductionMm(1300)).toBe(1285)
  })

  it('respects a custom tolerances object instead of the default', () => {
    const custom: VisturTolerances = { beamSegmentReductionMm: 10, lamellaLengthReductionMm: 20 }
    expect(applyVisturBeamSegmentReductionMm(1300, custom)).toBe(1290)
  })
})

describe('applyVisturLengthReductionMm', () => {
  it('внутренняя грань-грань 2000 → длина ламели 1970 (default tolerances)', () => {
    expect(applyVisturLengthReductionMm(2000)).toBe(1970)
  })

  it('respects a custom tolerances object instead of the default', () => {
    const custom: VisturTolerances = { beamSegmentReductionMm: 10, lamellaLengthReductionMm: 20 }
    expect(applyVisturLengthReductionMm(2000, custom)).toBe(1980)
  })
})

describe('DEFAULT_VISTUR_TOLERANCES', () => {
  it('is 15mm beam-segment / 30mm lamella-length — matches the prompt examples exactly', () => {
    expect(DEFAULT_VISTUR_TOLERANCES).toEqual({ beamSegmentReductionMm: 15, lamellaLengthReductionMm: 30 })
  })
})
