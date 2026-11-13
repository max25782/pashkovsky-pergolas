import {
  BASELINE_EFFECTIVE_FROM,
  currentTermsValues,
  planTermsHistory,
  validateTermsInput,
} from '../terms-history'
import { computeWorkerMonthPension, type WorkerTermsChange } from '../employer-cost'

const DEFAULTS = { employerCoefficient: 25, pensionRate: 12.5, pensionExempt: false }

describe('currentTermsValues', () => {
  it('uses the defaults for a row without the new columns', () => {
    expect(currentTermsValues({ daily_rate: 500 })).toEqual(DEFAULTS)
    expect(currentTermsValues(null)).toEqual(DEFAULTS)
  })

  it('reads stored values, also as strings from the database', () => {
    expect(
      currentTermsValues({ employer_coefficient: '30', pension_rate: '7', pension_exempt: true }),
    ).toEqual({ employerCoefficient: 30, pensionRate: 7, pensionExempt: true })
  })
})

describe('planTermsHistory', () => {
  it('writes nothing when the terms did not change', () => {
    expect(
      planTermsHistory({ before: DEFAULTS, after: { ...DEFAULTS }, hasHistory: false, today: '2026-11-13' }),
    ).toEqual([])
  })

  it('writes a baseline with the old values plus the new row on the first change', () => {
    const rows = planTermsHistory({
      before: DEFAULTS,
      after: { ...DEFAULTS, employerCoefficient: 30 },
      hasHistory: false,
      today: '2026-11-13',
    })
    expect(rows).toEqual([
      { effective_from: BASELINE_EFFECTIVE_FROM, employer_coefficient: 25, pension_rate: 12.5, pension_exempt: false },
      { effective_from: '2026-11-13', employer_coefficient: 30, pension_rate: 12.5, pension_exempt: false },
    ])
  })

  it('writes only the new row once a history exists', () => {
    const rows = planTermsHistory({
      before: { ...DEFAULTS, employerCoefficient: 30 },
      after: { ...DEFAULTS, employerCoefficient: 30, pensionExempt: true },
      hasHistory: true,
      today: '2026-12-01',
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ effective_from: '2026-12-01', pension_exempt: true })
  })

  it('the rows it plans reproduce a mid-month change per day', () => {
    const rows = planTermsHistory({
      before: DEFAULTS,
      after: { ...DEFAULTS, employerCoefficient: 40 },
      hasHistory: false,
      today: '2026-11-11',
    })
    const changes: WorkerTermsChange[] = rows
    const shifts = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12'].map((shift_date) => ({
      shift_date,
      shift_type: 'work',
      minutes_worked: 480,
    }))
    const result = computeWorkerMonthPension(shifts, {
      row: { daily_rate: 500, employer_coefficient: 40, pension_rate: 12.5 },
      changes,
    })
    // 2 days at 625 and 2 days at 700
    expect(result.gross).toBe(2650)
  })
})

describe('validateTermsInput', () => {
  it('accepts values in range and absent fields', () => {
    expect(validateTermsInput({})).toEqual({})
    expect(validateTermsInput({ employerCoefficient: 0, pensionRate: 100 })).toEqual({})
  })

  it('rejects out-of-range and non-finite values', () => {
    expect(validateTermsInput({ employerCoefficient: -1 }).employerCoefficient).toBeDefined()
    expect(validateTermsInput({ employerCoefficient: 201 }).employerCoefficient).toBeDefined()
    expect(validateTermsInput({ pensionRate: 101 }).pensionRate).toBeDefined()
    expect(validateTermsInput({ pensionRate: Number.NaN }).pensionRate).toBeDefined()
  })
})
