import {
  DEFAULT_EMPLOYER_COEFFICIENT,
  DEFAULT_PENSION_RATE,
  computeWorkerMonthPension,
  employerCost,
  resolveTermsOn,
  shiftProjectCost,
  sumProjectCost,
  workerTermsFromRow,
  type ShiftForCost,
  type WorkerCostContext,
} from '../employer-cost'

const WORKER_500 = { daily_rate: 500, hourly_rate: null }

function workShift(date: string): ShiftForCost {
  return { shift_type: 'work', minutes_worked: null, computed_cost: 500, shift_date: date }
}

function context(overrides: Partial<WorkerCostContext> = {}): WorkerCostContext {
  return { row: WORKER_500, changes: [], ...overrides }
}

describe('employer coefficient', () => {
  it('defaults to 25% and 12.5% pension', () => {
    const terms = workerTermsFromRow(WORKER_500)
    expect(terms.employerCoefficient).toBe(DEFAULT_EMPLOYER_COEFFICIENT)
    expect(terms.pensionRate).toBe(DEFAULT_PENSION_RATE)
    expect(terms.pensionExempt).toBe(false)
  })

  it('a worker at 500 with 25% costs 625 a day', () => {
    expect(employerCost(500, 25)).toBe(625)
    expect(shiftProjectCost(workShift('2026-11-02'), workerTermsFromRow(WORKER_500))).toBe(625)
  })

  it('acceptance: 4 days at 500 and 25% cost the project 2 500, not 2 000', () => {
    const days = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'].map(workShift)
    expect(sumProjectCost(days, context())).toBe(2500)
  })

  it('takes the coefficient saved on the worker', () => {
    const row = { ...WORKER_500, employer_coefficient: '30' }
    expect(sumProjectCost([workShift('2026-11-02')], context({ row }))).toBe(650)
  })

  it('a deleted worker uses the default 25% on the stored shift cost', () => {
    const orphan = { shift_type: 'work', minutes_worked: null, computed_cost: 800, shift_date: '2026-11-02' }
    expect(sumProjectCost([orphan], { row: null, changes: [] })).toBe(1000)
  })

  it('pays a holiday in full, a day off nothing, hours by the hourly rate', () => {
    const row = { daily_rate: 500, hourly_rate: 80 }
    const holiday = { shift_type: 'holiday', shift_date: '2026-11-02' }
    const dayOff = { shift_type: 'day_off', shift_date: '2026-11-03' }
    const hours = { shift_type: 'work', minutes_worked: 480, shift_date: '2026-11-04' }
    expect(sumProjectCost([holiday], context({ row }))).toBe(625)
    expect(sumProjectCost([dayOff], context({ row }))).toBe(0)
    expect(sumProjectCost([hours], context({ row }))).toBe(800) // 80 x 8h = 640 x 1.25
  })
})

describe('pension and pitzuim', () => {
  it('acceptance: 21 days x 625 = 13 125 gross, pension 1 640.63, project cost unchanged', () => {
    const shifts = Array.from({ length: 21 }, (_, i) =>
      workShift(`2026-11-${String(i + 1).padStart(2, '0')}`),
    )
    const result = computeWorkerMonthPension(shifts, context())
    expect(result.gross).toBe(13125)
    expect(result.pension).toBe(1640.63)
    expect(result.days).toBe(21)
    // The project cost is the same 13 125: pension is not deducted a second time.
    expect(sumProjectCost(shifts, context())).toBe(13125)
  })

  it('uses the pension rate saved on the worker', () => {
    const row = { ...WORKER_500, pension_rate: 6.5 }
    const result = computeWorkerMonthPension([workShift('2026-11-02')], context({ row }))
    expect(result.pension).toBe(40.63) // 625 x 6.5% = 40.625
  })

  it('a worker flagged without pension gets none', () => {
    const row = { ...WORKER_500, pension_exempt: true }
    const result = computeWorkerMonthPension([workShift('2026-11-02')], context({ row }))
    expect(result.pension).toBe(0)
    expect(result.exempt).toBe(true)
    expect(result.gross).toBe(625)
  })

  it('splits a month by day when the coefficient changed on the 11th', () => {
    const changes = [
      { effective_from: '2026-01-01', employer_coefficient: 25, pension_rate: 12.5 },
      { effective_from: '2026-11-11', employer_coefficient: 30, pension_rate: 12.5 },
    ]
    const shifts = [workShift('2026-11-10'), workShift('2026-11-11')]
    const result = computeWorkerMonthPension(shifts, context({ changes }))
    expect(result.gross).toBe(625 + 650)
    expect(result.pension).toBe(roundTo2((625 * 12.5) / 100 + (650 * 12.5) / 100))
  })

  it('splits a month by day when the pension rate changed mid-month', () => {
    const changes = [
      { effective_from: '2026-01-01', pension_rate: 12.5 },
      { effective_from: '2026-11-15', pension_rate: 14 },
    ]
    const shifts = [workShift('2026-11-14'), workShift('2026-11-15')]
    const result = computeWorkerMonthPension(shifts, context({ changes }))
    expect(result.pension).toBe(roundTo2((625 * 12.5) / 100 + (625 * 14) / 100))
  })

  it('an exempt period inside a month skips only those days', () => {
    const changes = [
      { effective_from: '2026-01-01', pension_exempt: false },
      { effective_from: '2026-11-20', pension_exempt: true },
    ]
    const shifts = [workShift('2026-11-19'), workShift('2026-11-20')]
    const result = computeWorkerMonthPension(shifts, context({ changes }))
    expect(result.pension).toBe(78.13) // only the 19th: 625 x 12.5% = 78.125
    expect(result.exempt).toBe(false)
  })

  it('days off cost nothing and do not count as days', () => {
    const result = computeWorkerMonthPension(
      [{ shift_type: 'day_off', shift_date: '2026-11-02' }],
      context(),
    )
    expect(result).toEqual({ gross: 0, pension: 0, days: 0, exempt: false })
  })
})

describe('resolveTermsOn', () => {
  const current = workerTermsFromRow({ daily_rate: 500, employer_coefficient: 25 })

  it('without changes the current terms apply', () => {
    expect(resolveTermsOn('2026-11-01', current, [])).toBe(current)
  })

  it('a date before the first change uses that first change', () => {
    const terms = resolveTermsOn('2025-01-01', current, [
      { effective_from: '2026-06-01', employer_coefficient: 28 },
    ])
    expect(terms.employerCoefficient).toBe(28)
  })

  it('a change that leaves the day rate empty keeps the current day rate', () => {
    const terms = resolveTermsOn('2026-11-30', current, [
      { effective_from: '2026-11-01', employer_coefficient: 35 },
    ])
    expect(terms.dailyRate).toBe(500)
    expect(terms.employerCoefficient).toBe(35)
  })
})

function roundTo2(value: number): number {
  return Math.round(value * 100 + 1e-9) / 100
}
